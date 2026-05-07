import { NextResponse } from 'next/server'
import { jsonError, mapProviderStatusToApiError } from '@/lib/http'
import { generateAnswer, streamAnswer } from '@/lib/llm'
import { addMessage, getSession } from '@/lib/repository'
import { isUuid } from '@/lib/validation'
import type { ChatRequest, ChatResponse } from '@/types/api'

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

  const session = await getSession(body.sessionId)
  if (!session) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'sessionId',
      reason: 'not_found',
    })
  }

  const createdAt = new Date().toISOString()
  const shouldStream = body.stream ?? true

  await addMessage(session.id, 'user', body.message)

  try {
    if (shouldStream) {
      const providerStream = await streamAnswer(body.message)
      const reader = providerStream.getReader()
      const decoder = new TextDecoder()

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(sse('start', {})))

          let streamUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null
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
              controller.enqueue(encoder.encode(sse('meta', { usage: streamUsage })))
            }

            try {
              const assistantMessage = await addMessage(session.id, 'assistant', assembledText)
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

    const result = await generateAnswer({ prompt: body.message })
    const assistantMessage = await addMessage(session.id, 'assistant', result.content)

    const response: ChatResponse = {
      messageId: assistantMessage.id,
      sessionId: body.sessionId,
      role: 'assistant',
      content: result.content,
      citations: [],
      usage: result.usage,
      createdAt,
    }

    return NextResponse.json(response)
  } catch (error) {
    const status = (error as Error & { cause?: { status?: number } }).cause?.status
    if (typeof status === 'number') {
      const mapped = mapProviderStatusToApiError(status)
      return jsonError(mapped.code, mapped.message, mapped.status)
    }

    return jsonError('INTERNAL_ERROR', 'サーバーエラーが発生しました。時間をおいて再試行してください。', 500)
  }
}
