import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { listSessions } from '@/lib/store'
import { isUuid } from '@/lib/validation'
import type { SessionsListResponse } from '@/types/api'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limitParam = url.searchParams.get('limit')
  const cursor = url.searchParams.get('cursor')

  const limit = limitParam ? Number(limitParam) : 20
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'limit',
      reason: 'invalid_range',
    })
  }

  if (cursor && !isUuid(cursor)) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'cursor',
      reason: 'invalid_format',
    })
  }

  const raw = listSessions(limit, cursor)

  const response: SessionsListResponse = {
    items: raw.items.map((s) => ({
      id: s.id,
      title: s.title,
      lastMessageAt: s.lastMessageAt,
      createdAt: s.createdAt,
    })),
    nextCursor: raw.nextCursor,
  }

  return NextResponse.json(response)
}
