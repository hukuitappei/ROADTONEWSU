'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { QuestionHistory } from '@/app/upload/components/QuestionHistory'
import type { ApiError, ChatResponse, DocumentDetail, MessageItem, TokenUsage } from '@/types/api'

type UploadResponse = {
  uploadId: string
  sessionId: string
  fileName: string
  fileSize: number
  status: string
  createdAt: string
}

const getUserId = (): string => {
  const stored = localStorage.getItem('phase1_user_id')
  if (stored) return stored
  const id = crypto.randomUUID()
  localStorage.setItem('phase1_user_id', id)
  return id
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
    if (reason === 'invalid_pdf_signature') {
      return 'PDFの解析に失敗しました。画像PDFの可能性があります。テキストを含むPDFで再度お試しください。'
    }
    if (reason === 'invalid_mime') {
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
  const [userId, setUserId] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [documentStates, setDocumentStates] = useState<Record<string, DocumentDetail>>({})
  const [question, setQuestion] = useState('')
  const [qaAnswer, setQaAnswer] = useState('')
  const [qaErrorMessage, setQaErrorMessage] = useState<string | null>(null)
  const [qaUsage, setQaUsage] = useState<TokenUsage | null>(null)
  const [qaEstimatedCostUsd, setQaEstimatedCostUsd] = useState<number | null>(null)
  const [isAsking, setIsAsking] = useState(false)
  const [history, setHistory] = useState<MessageItem[]>([])
  const [historyKeyword, setHistoryKeyword] = useState('')
  const [historyDocumentFilter, setHistoryDocumentFilter] = useState('all')
  const [highlightedChunkId, setHighlightedChunkId] = useState<string | null>(null)
  const [resendErrorMessage, setResendErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setUserId(getUserId())
  }, [])

  // documentStates を ref で参照することで、ポーリング interval が
  // state 更新のたびに再起動しないようにする。
  const documentStatesRef = useRef(documentStates)
  documentStatesRef.current = documentStates

  useEffect(() => {
    if (!userId || selectedDocumentIds.length === 0) return

    const controller = new AbortController()

    const fetchDocumentStatus = async (id: string) => {
      try {
        const response = await fetch(`/api/documents/${id}`, {
          signal: controller.signal,
          headers: { 'x-user-id': userId },
        })
        if (!response.ok) return
        const payload = (await response.json()) as { document: DocumentDetail }
        setDocumentStates((prev) => ({ ...prev, [id]: payload.document }))
      } catch {
        // no-op
      }
    }

    const poll = () => {
      selectedDocumentIds.forEach((id) => {
        const doc = documentStatesRef.current[id]
        if (!doc || doc.status === 'processing' || doc.status === 'uploaded') {
          void fetchDocumentStatus(id)
        }
      })
    }

    poll()
    const intervalId = setInterval(poll, 2500)

    return () => {
      controller.abort()
      clearInterval(intervalId)
    }
  }, [selectedDocumentIds, userId])

  const canSubmit = useMemo(() => !isUploading && file !== null && userId !== '', [file, isUploading, userId])
  const activeReadyDocs = useMemo(
    () => selectedDocumentIds.map((id) => documentStates[id]).filter((doc): doc is DocumentDetail => Boolean(doc?.status === 'ready' && doc.qaEnabled)),
    [documentStates, selectedDocumentIds],
  )

  useEffect(() => {
    const sid = uploadResult?.sessionId
    if (!sid || !userId) return
    void (async () => {
      try {
        const res = await fetch(`/api/sessions/${sid}?limit=100`, { headers: { 'x-user-id': userId } })
        if (!res.ok) return
        const json = (await res.json()) as { messages: MessageItem[] }
        setHistory(json.messages)
      } catch {
        // no-op
      }
    })()
  }, [uploadResult?.sessionId, userId, qaAnswer])

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
        headers: { 'x-user-id': userId },
        body: formData,
      })

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const seconds = retryAfter ? parseInt(retryAfter, 10) : null
          setUploadResult(null)
          setErrorMessage(
            Number.isFinite(seconds) && seconds !== null
              ? `アクセスが集中しています。${seconds}秒後に再試行してください。`
              : 'アクセスが集中しています。しばらく待ってから再試行してください。'
          )
          return
        }
        let error: ApiError | null = null
        try {
          error = (await response.json()) as ApiError
        } catch {
          error = null
        }
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

  const dismissDocument = (id: string) => {
    setSelectedDocumentIds((prev) => prev.filter((did) => did !== id))
    setDocumentStates((prev) => {
      const { [id]: _, ...rest } = prev
      return rest
    })
  }



  const CHAT_ERROR_MESSAGE = '回答の取得に失敗しました。ネットワーク状態を確認のうえ、再送してください。'

  const mapChatErrorMessage = (res: Response): string => {
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After')
      const seconds = retryAfter ? parseInt(retryAfter, 10) : null
      return Number.isFinite(seconds) && seconds !== null
        ? `アクセスが集中しています。${seconds}秒後に再試行してください。`
        : 'アクセスが集中しています。しばらく待ってから再試行してください。'
    }
    return CHAT_ERROR_MESSAGE
  }

  const sendQuestion = async (message: string): Promise<boolean> => {
    if (!uploadResult?.sessionId || !message.trim() || activeReadyDocs.length === 0) return false

    setIsAsking(true)
    setQaAnswer('')
    setQaErrorMessage(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ sessionId: uploadResult.sessionId, message, documentIds: activeReadyDocs.map((d) => d.id), stream: false }),
      })
      if (!res.ok) {
        setQaErrorMessage(mapChatErrorMessage(res))
        setQaUsage(null)
        setQaEstimatedCostUsd(null)
        return false
      }
      const json = (await res.json()) as ChatResponse
      setQaAnswer(json.content ?? '回答を取得できませんでした。')
      setQaUsage(json.usage ?? null)
      setQaEstimatedCostUsd(typeof json.estimatedCostUsd === 'number' ? json.estimatedCostUsd : null)
      return true
    } catch {
      setQaErrorMessage(CHAT_ERROR_MESSAGE)
      setQaUsage(null)
      setQaEstimatedCostUsd(null)
      return false
    } finally {
      setIsAsking(false)
    }
  }
  const askQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await sendQuestion(question)
  }

  const formatUsd = (value: number) => `$${value.toFixed(6)}`

  const refillQuestion = (value: string) => {
    setQuestion(value)
  }


  const resendQuestion = async (message: string) => {
    setResendErrorMessage(null)
    setQuestion(message)
    const ok = await sendQuestion(message)
    if (!ok) {
      setResendErrorMessage('質問の再送に失敗しました。時間をおいて再試行してください。')
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
                      <button type="button" onClick={() => dismissDocument(id)}>
                        リストから削除して再アップロード
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Q&A</h2>
        <p>ready かつ Q&A有効なドキュメントを対象に質問できます。</p>
        <form onSubmit={askQuestion} style={{ display: 'grid', gap: '0.5rem' }}>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={4} placeholder="質問を入力" />
          <button type="submit" disabled={isAsking || activeReadyDocs.length === 0 || !uploadResult?.sessionId}>
            {isAsking ? '回答生成中…' : '質問する'}
          </button>
        </form>
        {qaErrorMessage && <div style={{ marginTop: '0.75rem', color: '#b00020' }}>{qaErrorMessage}</div>}
        {qaAnswer && (
          <div style={{ marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>
            回答: {qaAnswer}
            {qaUsage && (
              <div style={{ marginTop: '0.5rem' }}>
                トークン内訳: prompt={qaUsage.promptTokens}, completion={qaUsage.completionTokens}, total={qaUsage.totalTokens}
              </div>
            )}
            {qaEstimatedCostUsd !== null && <div>概算コスト: {formatUsd(qaEstimatedCostUsd)}</div>}
          </div>
        )}
      </section>


      <QuestionHistory
        history={history}
        selectedDocumentIds={selectedDocumentIds}
        keyword={historyKeyword}
        onKeywordChange={setHistoryKeyword}
        documentFilter={historyDocumentFilter}
        onDocumentFilterChange={setHistoryDocumentFilter}
        onRefillQuestion={refillQuestion}
        onResendQuestion={resendQuestion}
        resendErrorMessage={resendErrorMessage ?? qaErrorMessage}
        highlightedChunkId={highlightedChunkId}
        onCitationClick={setHighlightedChunkId}
        formatUsd={formatUsd}
        isResending={isAsking}
      />
    </main>
  )
}
