import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { getMessages, getSession, getSessionDocuments } from '@/lib/store'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = getSession(params.id)
  if (!session) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'id',
      reason: 'not_found',
    })
  }

  return NextResponse.json({
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    documents: getSessionDocuments(session.id),
    messages: getMessages(session.id),
  })
}
