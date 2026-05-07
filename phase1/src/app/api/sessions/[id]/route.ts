import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { getMessages, getSession, getSessionDocuments } from '@/lib/store'
import { isUuid } from '@/lib/validation'
import type { SessionDetailResponse } from '@/types/api'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'id',
      reason: 'invalid_format',
    })
  }

  const session = getSession(params.id)
  if (!session) {
    return jsonError('NOT_FOUND', '対象のセッションが見つかりません。', 404, {
      field: 'id',
      reason: 'not_found',
    })
  }

  const url = new URL(req.url)
  const limitParam = url.searchParams.get('limit')
  const before = url.searchParams.get('before')

  if (before && !isUuid(before)) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'before',
      reason: 'invalid_format',
    })
  }

  const limit = limitParam ? Number(limitParam) : 50
  if (!Number.isFinite(limit) || limit < 1 || limit > 200) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'limit',
      reason: 'invalid_range',
    })
  }

  const { items: msgs, hasMore } = getMessages(session.id, limit, before)
  const docs = getSessionDocuments(session.id)

  const response: SessionDetailResponse = {
    session: {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
    },
    documents: docs.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      status: doc.status,
      qaEnabled: doc.qaEnabled,
      summary: doc.summary,
      createdAt: doc.createdAt,
    })),
    messages: msgs.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    })),
    hasMore,
  }

  return NextResponse.json(response)
}
