import { withUserRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { requireUserId } from '@/lib/auth'
import { enqueueDocumentProcessing } from '@/lib/summary'
import { createDocument, createSession, deleteDocument, getSession, updateDocument, updateDocumentStoragePath } from '@/lib/repository'
import { isUuid } from '@/lib/validation'
import { deletePdfFromStorage, savePdfToStorage, StorageSaveError } from '@/lib/supabase'

const MAX_PDF_BYTES = 10 * 1024 * 1024

// MIME タイプはクライアントが偽装できるため、ファイル先頭バイトでも検証する。
const hasPdfMagicBytes = async (file: File): Promise<boolean> => {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  const magic = String.fromCharCode(...header)
  return magic.startsWith('%PDF-')
}

export async function POST(req: Request) {
  return withUserRateLimit(req, async () => {
    const auth = requireUserId(req)
    if (!auth.ok) return auth.response
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return jsonError('BAD_REQUEST', 'リクエストが不正です', 400, { field: 'body', reason: 'invalid_form_data' })
    }

    const file = form.get('file')
    const sessionId = form.get('sessionId')?.toString().trim()

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

    if (!(await hasPdfMagicBytes(file))) {
      return jsonError('BAD_REQUEST', 'PDFの解析に失敗しました。テキストを含む通常のPDFファイルを指定してください。', 400, {
        field: 'file',
        reason: 'invalid_pdf_signature',
      })
    }

    if (sessionId && !isUuid(sessionId)) {
      return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
        field: 'sessionId',
        reason: 'invalid_format',
      })
    }

    let session
    try {
      session = sessionId ? await getSession(sessionId, auth.userId) : await createSession(auth.userId, `${file.name} の要約`)
    } catch {
      return jsonError('INTERNAL_ERROR', 'サーバーエラーが発生しました。時間をおいて再試行してください。', 500)
    }

    if (!session) {
      return jsonError('BAD_REQUEST', '入力内容に誤りがあります。内容を確認してください。', 400, {
        field: 'sessionId',
        reason: 'not_found',
      })
    }

    let uploadedStoragePath: string | null = null
    try {
      const binary = await file.arrayBuffer()
      const saved = await savePdfToStorage(session.id, file.name, binary, file.type || 'application/pdf')
      uploadedStoragePath = saved.storage_path
    } catch (error) {
      if (error instanceof StorageSaveError) {
        if (error.type === 'authorization') {
          return jsonError('INTERNAL_ERROR', 'ストレージへの保存権限がありません。管理者に連絡してください。', 500)
        }
        if (error.type === 'capacity') {
          return jsonError('PAYLOAD_TOO_LARGE', 'ストレージ容量またはファイルサイズ制限を超えています。', 413)
        }
        if (error.type === 'network') {
          return jsonError('INTERNAL_ERROR', 'ネットワークエラーによりアップロードに失敗しました。再試行してください。', 503)
        }
      }
      return jsonError('INTERNAL_ERROR', 'サーバーエラーが発生しました。時間をおいて再試行してください。', 500)
    }

    let document
    try {
      document = await createDocument(session.id, file.name, auth.userId)
      if (uploadedStoragePath) {
        await updateDocumentStoragePath(document.id, uploadedStoragePath)
      }
    } catch {
      if (uploadedStoragePath) {
        try {
          await deletePdfFromStorage(uploadedStoragePath)
        } catch {
          // ロールバック失敗時は監視で検知する前提で、クライアントには作成失敗を返す。
        }
      }
      return jsonError('INTERNAL_ERROR', 'サーバーエラーが発生しました。時間をおいて再試行してください。', 500)
    }

    try {
      await updateDocument(document.id, { status: 'processing', error_message: null })
    } catch {
      try {
        await deleteDocument(document.id)
      } catch {
        // documents行の削除失敗は運用監視に委ねる
      }
      if (uploadedStoragePath) {
        try {
          await deletePdfFromStorage(uploadedStoragePath)
        } catch {
          // storage側の削除失敗は運用監視に委ねる
        }
      }
      return jsonError('INTERNAL_ERROR', 'サーバーエラーが発生しました。時間をおいて再試行してください。', 500)
    }

    void enqueueDocumentProcessing(document.id, file)

    return NextResponse.json({
      uploadId: document.id,
      sessionId: session.id,
      fileName: document.filename,
      fileSize: file.size,
      status: document.status,
      createdAt: document.created_at ?? new Date().toISOString(),
    })
  })
}
