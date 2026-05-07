import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { getDocument } from '@/lib/store'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const doc = getDocument(params.id)
  if (!doc) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'id',
      reason: 'not_found',
    })
  }

  return NextResponse.json({
    id: doc.id,
    sessionId: doc.sessionId,
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    status: doc.status,
    createdAt: doc.createdAt,
  })
}
