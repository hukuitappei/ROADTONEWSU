import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { listSessions } from '@/lib/store'

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

  const data = listSessions(limit, cursor)
  return NextResponse.json(data)
}
