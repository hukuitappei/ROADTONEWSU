'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { ApiError, DocumentDetail } from '@/types/api'

type UploadResponse = {
  uploadId: string
  sessionId: string
  fileName: string
  fileSize: number
  status: string
  createdAt: string
}

const mapUploadErrorMessage = (error: ApiError | null): string => {
  if (!error) return 'アップロードに失敗しました。時間をおいて再試行してください。'

  const code = error.error.code
  const details = error.error.details ?? {}
  const reason = typeof details.reason === 'string' ? details.reason : null

  if (code === 'PAYLOAD_TOO_LARGE') {
    return 'ファイルサイズが大きすぎます。10MB以下のPDFを選択してください。'
  }

  if (code === 'BAD_REQUEST') {
    if (reason === 'invalid_mime' || reason === 'invalid_pdf_signature') {
      return 'PDF形式のファイルのみアップロードできます。別のファイルを選択してください。'
    }
    if (reason === 'required') {
      return 'PDFファイルを選択してください。'
    }
  }

  if (code === 'INTERNAL_ERROR') {
    return 'PDFの抽出処理に失敗しました。しばらくしてから再度お試しください。'
  }

  return 'アップロードに失敗しました。時間をおいて再試行してください。'
}

export default function UploadPage() {
  const [sessionId, setSessionId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [documentStates, setDocumentStates] = useState<Record<string, DocumentDetail>>({})

  useEffect(() => {
    if (selectedDocumentIds.length === 0) return

    const controller = new AbortController()

    const fetchDocumentStatus = async (id: string) => {
      try {
        const response = await fetch(`/api/documents/${id}`, { signal: controller.signal })
        if (!response.ok) return
        const payload = (await response.json()) as { document: DocumentDetail }
        setDocumentStates((prev) => ({ ...prev, [id]: payload.document }))
      } catch {
        // no-op
      }
    }

    selectedDocumentIds.forEach((id) => {
      const doc = documentStates[id]
      if (!doc || doc.status === 'processing' || doc.status === 'uploaded') {
        void fetchDocumentStatus(id)
      }
    })

    const intervalId = setInterval(() => {
      selectedDocumentIds.forEach((id) => {
        const doc = documentStates[id]
        if (!doc || doc.status === 'processing' || doc.status === 'uploaded') {
          void fetchDocumentStatus(id)
        }
      })
    }, 2500)

    return () => {
      controller.abort()
      clearInterval(intervalId)
    }
  }, [selectedDocumentIds, documentStates])

  const canSubmit = useMemo(() => !isUploading && file !== null, [file, isUploading])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || !file) return

    setIsUploading(true)
    setErrorMessage(null)

    const formData = new FormData()
    formData.append('file', file)

    const normalizedSessionId = sessionId.trim()
    if (normalizedSessionId) {
      formData.append('sessionId', normalizedSessionId)
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = (await response.json()) as ApiError
        setUploadResult(null)
        setErrorMessage(mapUploadErrorMessage(error))
        return
      }

      const payload = (await response.json()) as UploadResponse
      setUploadResult(payload)
      setSelectedDocumentIds((prev) => (prev.includes(payload.uploadId) ? prev : [...prev, payload.uploadId]))
      setErrorMessage(null)
    } catch {
      setUploadResult(null)
      setErrorMessage('通信エラーが発生しました。ネットワーク状態を確認して再試行してください。')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>PDFアップロード</h1>
      <p>PDFをアップロードし、要約・Q&Aの対象ドキュメントとして利用します。</p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem', marginTop: '1.5rem' }}>
        <label htmlFor="sessionId">Session ID（任意）</label>
        <input
          id="sessionId"
          name="sessionId"
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
          placeholder="既存セッションIDを入力"
          disabled={isUploading}
        />

        <label htmlFor="pdfFile">PDFファイル</label>
        <input
          id="pdfFile"
          name="file"
          type="file"
          accept="application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          disabled={isUploading}
        />

        <button type="submit" disabled={!canSubmit}>
          {isUploading ? 'アップロード中…' : 'アップロード'}
        </button>
      </form>

      {isUploading && <p>アップロードを実行しています。完了までお待ちください。</p>}
      {errorMessage && <p style={{ color: '#b00020' }}>{errorMessage}</p>}

      {uploadResult && (
        <section style={{ marginTop: '1.5rem' }}>
          <h2>アップロード結果</h2>
          <ul>
            <li>documentId: {uploadResult.uploadId}</li>
            <li>filename: {uploadResult.fileName}</li>
            <li>status: {uploadResult.status}</li>
            <li>sessionId: {uploadResult.sessionId}</li>
            <li>createdAt: {uploadResult.createdAt}</li>
          </ul>
        </section>
      )}

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Q&A対象ドキュメント（保持中）</h2>
        {selectedDocumentIds.length === 0 ? (
          <p>まだ対象ドキュメントはありません。</p>
        ) : (
          <ul>
            {selectedDocumentIds.map((id) => {
              const doc = documentStates[id]
              return (
                <li key={id} style={{ marginBottom: '1rem' }}>
                  <div>documentId: {id}</div>
                  <div>status: {doc?.status ?? 'processing'}</div>
                  {doc?.status === 'processing' && (
                    <div aria-live="polite">⏳ 抽出中/要約中…</div>
                  )}
                  {doc?.exceedsQaLimit && (
                    <div style={{ color: '#8a5a00' }}>このPDFはPhase 1のQ&A上限を超えています。要約のみ対応します。</div>
                  )}
                  {doc?.status === 'ready' && (
                    <>
                      <div>page_count: {doc.pageCount ?? '-'}</div>
                      <div>char_count: {doc.charCount ?? '-'}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>summary: {doc.summary ?? '（要約なし）'}</div>
                    </>
                  )}
                  {doc?.status === 'error' && (
                    <>
                      <div style={{ color: '#b00020' }}>error: {doc.errorMessage ?? '処理に失敗しました。'}</div>
                      <button type="button" onClick={() => window.location.reload()}>
                        再試行
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
