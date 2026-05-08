import { withUserRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { requireUserId } from '@/lib/auth'
import { getDocument } from '@/lib/repository'
import { isUuid } from '@/lib/validation'
import { mapDbDocumentToDetail, type DocumentDetailResponse } from '@/types/api'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withUserRateLimit(req, async () => {
    const auth = requireUserId(req)
    if (!auth.ok) return auth.response
    if (!isUuid(id)) {
      return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
        field: 'id',
        reason: 'invalid_format',
      })
    }

    let doc
    try {
      doc = await getDocument(id, auth.userId)
    } catch {
      return jsonError('INTERNAL_ERROR', 'サーバーエラーが発生しました。時間をおいて再試行してください。', 500)
    }

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
  })
}
