import { withUserRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { getDocument } from '@/lib/repository'
import { isUuid } from '@/lib/validation'
import { mapDbDocumentToDetail, type DocumentDetailResponse } from '@/types/api'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withUserRateLimit(req, async () => {
  if (!isUuid(params.id)) {
    return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
      field: 'id',
      reason: 'invalid_format',
    })
  }

  const doc = await getDocument(params.id)
  if (!doc) {
    return jsonError('NOT_FOUND', '対象のドキュメントが見つかりません。', 404, {
      field: 'id',
      reason: 'not_found',
    })
  }

  const response: DocumentDetailResponse = {
    document: mapDbDocumentToDetail(doc),
  }

  return NextResponse.json(response)
}
  })
}
