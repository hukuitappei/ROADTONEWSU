import { withUserRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { getMessages, getSession, getSessionDocuments } from '@/lib/repository'
import { isUuid } from '@/lib/validation'
import { mapDbDocumentToSummary, mapDbMessageToMessageItem, mapDbSessionToSessionDetail, type SessionDetailResponse } from '@/types/api'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withUserRateLimit(req, async () => {
  if (!isUuid(params.id)) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'id',
      reason: 'invalid_format',
    })
  }

  const session = await getSession(params.id)
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

  const { items: msgs, hasMore } = await getMessages(session.id, limit, before)
  const docs = await getSessionDocuments(session.id)

  const response: SessionDetailResponse = {
    session: mapDbSessionToSessionDetail(session),
    documents: docs.map(mapDbDocumentToSummary),
    messages: msgs.map(mapDbMessageToMessageItem),
    hasMore,
  }

  return NextResponse.json(response)
}
  })
}
