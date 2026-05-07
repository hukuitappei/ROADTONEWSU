import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { createDocument, createSession, getSession } from '@/lib/store'

const MAX_PDF_BYTES = 10 * 1024 * 1024

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file')
  const sessionId = form.get('sessionId')?.toString()

  if (!(file instanceof File)) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'file',
      reason: 'required',
    })
  }

  if (file.type !== 'application/pdf') {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'file',
      reason: 'invalid_mime',
    })
  }

  if (file.size > MAX_PDF_BYTES) {
    return jsonError('PAYLOAD_TOO_LARGE', 'ファイルサイズが上限を超えています', 413, {
      maxBytes: MAX_PDF_BYTES,
    })
  }

  const session = sessionId ? getSession(sessionId) : createSession(`${file.name} の要約`)
  if (!session) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'sessionId',
      reason: 'not_found',
    })
  }

  const document = createDocument(session.id, file.name, file.size)

  return NextResponse.json({
    uploadId: document.id,
    sessionId: session.id,
    fileName: document.fileName,
    fileSize: document.fileSize,
    status: document.status,
    createdAt: document.createdAt,
  })
}
