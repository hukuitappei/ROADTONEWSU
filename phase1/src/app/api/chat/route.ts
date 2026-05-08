import { withUserRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { jsonError, mapProviderErrorToApiError } from '@/lib/http'
import { requireUserId } from '@/lib/auth'
import { generateAnswer, streamAnswer } from '@/lib/llm'
import { addMessage, getDocumentChunks, getDocumentsByIds, getSession } from '@/lib/repository'
import { estimateCost } from '@/lib/pricing'
import { isUuid } from '@/lib/validation'
import type { ChatRequest, ChatResponse } from '@/types/api'

const MAX_CONTEXT_DOCS = 5
const PHASE1_QA_CHUNK_LIMIT = 5
const NO_ANSWER_MESSAGE = 'PDFの内容からは判断できません（根拠不足または関連箇所なし）。'
const PROMPT_VERSION = 'v1.2'
const SYSTEM_PROMPT = `あなたはPDF内容に基づいて回答するアシスタントです（prompt:${PROMPT_VERSION}）。根拠がない場合は「PDFの内容からは判断できません」と答えてください。`

const buildChunkCitation = (chunkId: string, pageStart: number | null | undefined, pageEnd: number | null | undefined, quote: string) => ({
  chunkId,
  pageStart: pageStart ?? 1,
  pageEnd: pageEnd ?? 1,
  quote,
})

const buildContext = async (userId: string, documentIds: string[] | undefined) => {
  const ids = (documentIds ?? []).slice(0, MAX_CONTEXT_DOCS)
  const docs = await getDocumentsByIds(userId, ids)
  const readyDocs = docs.filter((doc: { status: string; qa_enabled: boolean | null }) => doc.status === 'ready' && Boolean(doc.qa_enabled))

  const docContexts = await Promise.all(
    readyDocs.map(async (doc) => {
      const chunks = await getDocumentChunks(doc.id, PHASE1_QA_CHUNK_LIMIT)
      if (chunks.length > 0) {
        return {
          contextText: `Document ${doc.id} (${doc.filename})\n${chunks.map((c) => c.content).join('\n\n')}`,
          citations: chunks.map((c) => ({
            ...buildChunkCitation(`${doc.id}:${c.chunk_index}`, c.page_start, c.page_end, c.content.slice(0, 120)),
          })),
        }
      }
      // fallback for documents processed before chunk saving was introduced
      return {
        contextText: `Document ${doc.id} (${doc.filename})\n${doc.summary ?? ''}`,
        citations: [{
          ...buildChunkCitation(`${doc.id}:summary`, 1, doc.page_count ?? 1, (doc.summary ?? '').slice(0, 120)),
        }],
      }
    }),
  )

  const context = docContexts
    .map((d) => d.contextText)
    .filter((v) => v.trim().length > 0)
    .join('\n\n')

  const citations = docContexts.flatMap((d) => d.citations)

  return { context, citations, qaBlocked: ids.length > 0 && readyDocs.length === 0 }
}

const encoder = new TextEncoder()

const sse = (event: string, data: Record<string, unknown>) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

const parseBody = async (req: Request): Promise<{ body: ChatRequest | null; invalidJson: boolean }> => {
  try {
    return { body: (await req.json()) as ChatRequest, invalidJson: false }
  } catch {
    return { body: null, invalidJson: true }
  }
}

const validateBody = (body: ChatRequest | null) => {
  if (!body?.sessionId) {
    return { ok: false as const, field: 'sessionId' }
  }

  if (!isUuid(body.sessionId)) {
    return { ok: false as const, field: 'sessionId_format' }
  }

  if (!body?.message?.trim()) {
    return { ok: false as const, field: 'message' }
  }

  if (body.message.length > 10_000) {
    return { ok: false as const, field: 'message_too_long' }
  }

  if (body.documentIds?.some((id) => !isUuid(id))) {
    return { ok: false as const, field: 'documentIds_format' }
  }

  return { ok: true as const }
}

export async function POST(req: Request) {
  return withUserRateLimit(req, async () => {
    const auth = requireUserId(req)
    if (!auth.ok) return auth.response
    const parsed = await parseBody(req)
  if (parsed.invalidJson) {
    return jsonError('BAD_REQUEST', 'リクエストが不正です', 400, { field: 'body', reason: 'invalid_json' })
  }

  const body = parsed.body
  const validated = validateBody(body)

  if (!validated.ok) {
    if (validated.field === 'message_too_long') {
      return jsonError('PAYLOAD_TOO_LARGE', '入力サイズが上限を超えています。短くするか対象を絞ってください。', 413)
    }

    if (validated.field === 'sessionId_format' || validated.field === 'documentIds_format') {
      return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
        field: validated.field === 'sessionId_format' ? 'sessionId' : 'documentIds',
        reason: 'invalid_format',
      })
    }

    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: validated.field,
      reason: 'required',
    })
  }
  const requestBody = body as ChatRequest

  let session
  try {
    session = await getSession(requestBody.sessionId, auth.userId)
  } catch {
    return jsonError('INTERNAL_ERROR', 'サーバーエラーが発生しました。時間をおいて再試行してください。', 500)
  }
  if (!session) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'sessionId',
      reason: 'not_found',
    })
  }

  const createdAt = new Date().toISOString()
  const shouldStream = body.stream ?? true

  try {
    await addMessage(session.id, auth.userId, 'user', requestBody.message)
  } catch {
    return jsonError('INTERNAL_ERROR', 'サーバーエラーが発生しました。時間をおいて再試行してください。', 500)
  }

  try {
    const { context, citations, qaBlocked } = await buildContext(auth.userId, requestBody.documentIds)
    if (qaBlocked) {
      const assistantMessage = await addMessage(session.id, auth.userId, 'assistant', NO_ANSWER_MESSAGE, [])
      return NextResponse.json({
        messageId: assistantMessage.id,
        sessionId: requestBody.sessionId,
        role: 'assistant',
        content: NO_ANSWER_MESSAGE,
        citations: [],
        createdAt,
      } satisfies ChatResponse)
    }

    const prompt = context ? `# 参照コンテキスト\n${context}\n\n# 質問\n${requestBody.message}` : requestBody.message

    if (shouldStream) {
      const providerStream = await streamAnswer(prompt, undefined, SYSTEM_PROMPT)
      const reader = providerStream.getReader()
      const decoder = new TextDecoder()

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(sse('start', {})))

          let streamUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null
          let streamModel: string | null = null
          let assembledText = ''

          try {
            while (true) {
              const { value, done } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n').map((line) => line.trim())
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue
                const payload = line.slice(6)
                if (!payload || payload === '[DONE]') continue

                try {
                  const json = JSON.parse(payload)
                  const delta = json?.choices?.[0]?.delta?.content
                  if (delta) {
                    assembledText += delta
                    controller.enqueue(encoder.encode(sse('token', { delta })))
                  }
                  // stream_options: { include_usage: true } で最終チャンクに usage が付く
                  if (typeof json?.model === 'string') {
                    streamModel = json.model
                  }
                  if (json?.usage) {
                    streamUsage = {
                      promptTokens: json.usage.prompt_tokens,
                      completionTokens: json.usage.completion_tokens,
                      totalTokens: json.usage.total_tokens,
                    }
                  }
                } catch {
                  // ignore partial JSON chunks
                }
              }
            }

            if (streamUsage) {
              let estimatedCostUsd: number | undefined
              if (streamModel) {
                try {
                  estimatedCostUsd = estimateCost({
                    model: streamModel,
                    promptTokens: streamUsage.promptTokens,
                    completionTokens: streamUsage.completionTokens,
                  })
                } catch {
                  estimatedCostUsd = undefined
                }
              }

              controller.enqueue(encoder.encode(sse('meta', { usage: streamUsage, estimatedCostUsd })))
            }

            try {
              const assistantMessage = await addMessage(session.id, auth.userId, 'assistant', assembledText, citations)
              controller.enqueue(
                encoder.encode(
                  sse('done', {
                    messageId: assistantMessage.id,
                    finishReason: 'stop',
                  }),
                ),
              )
            } catch (error) {
              console.error('INTERNAL_ERROR: failed to persist assistant message', {
                sessionId: session.id,
                error,
              })
              controller.enqueue(
                encoder.encode(
                  sse('error', {
                    code: 'INTERNAL_ERROR',
                    message: 'サーバーエラーが発生しました。時間をおいて再試行してください。',
                  }),
                ),
              )
            }

            controller.close()
          } catch {
            controller.enqueue(
              encoder.encode(
                sse('error', {
                  code: 'INTERNAL_ERROR',
                  message: 'サーバーエラーが発生しました。時間をおいて再試行してください。',
                }),
              ),
            )
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      })
    }

    const result = await generateAnswer({ prompt, systemPrompt: SYSTEM_PROMPT })
    const content = result.content.trim() || NO_ANSWER_MESSAGE

    let estimatedCostUsd: number | undefined
    if (result.usage && result.model) {
      try {
        estimatedCostUsd = estimateCost({
          model: result.model,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
        })
      } catch {
        estimatedCostUsd = undefined
      }
    }

    const assistantMessage = await addMessage(session.id, auth.userId, 'assistant', content, citations)

    const response: ChatResponse = {
      messageId: assistantMessage.id,
      sessionId: requestBody.sessionId,
      role: 'assistant',
      content,
      citations,
      usage: result.usage,
      estimatedCostUsd,
      createdAt,
    }

    return NextResponse.json(response)
  } catch (error) {
    const mapped = mapProviderErrorToApiError((error as Error & { cause?: { status?: number; code?: string } }).cause)
    return jsonError(mapped.code, mapped.message, mapped.status)
  }
  })
}
