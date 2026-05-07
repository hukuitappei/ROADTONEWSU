import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { generateAnswer } from '@/lib/llm'
import type { ChatRequest } from '@/types/api'

export async function POST(req: Request) {
  let body: ChatRequest

  try {
    body = (await req.json()) as ChatRequest
  } catch {
    return jsonError('BAD_REQUEST', 'リクエストが不正です', 400, { field: 'body', reason: 'invalid_json' })
  }

  if (!body?.sessionId || !body?.message?.trim()) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: !body?.sessionId ? 'sessionId' : 'message',
      reason: 'required',
    })
  }

  try {
    const result = await generateAnswer(body.message)
    return NextResponse.json({
      messageId: crypto.randomUUID(),
      sessionId: body.sessionId,
      role: 'assistant',
      content: result.content,
      citations: [],
      usage: result.usage,
      createdAt: new Date().toISOString(),
    })
  } catch {
    return jsonError('INTERNAL_ERROR', 'サーバーエラーが発生しました。時間をおいて再試行してください。', 500)
  }
}
