import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { getDocument } from '@/lib/store'
import { isUuid } from '@/lib/validation'
import type { DocumentDetailResponse } from '@/types/api'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'id',
      reason: 'invalid_format',
    })
  }

  const doc = getDocument(params.id)
  if (!doc) {
    return jsonError('NOT_FOUND', '対象のドキュメントが見つかりません。', 404, {
      field: 'id',
      reason: 'not_found',
    })
  }

  const response: DocumentDetailResponse = {
    document: {
      id: doc.id,
      sessionId: doc.sessionId,
      fileName: doc.fileName,
      status: doc.status,
      qaEnabled: doc.qaEnabled,
      summary: doc.summary,
      pageCount: doc.pageCount,
      charCount: doc.charCount,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    },
  }

  return NextResponse.json(response)
}
