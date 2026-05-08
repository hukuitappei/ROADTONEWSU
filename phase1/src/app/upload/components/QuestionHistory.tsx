'use client'

import type { Citation, MessageItem, TokenUsage } from '@/types/api'

type QuestionHistoryProps = {
  history: MessageItem[]
  selectedDocumentIds: string[]
  keyword: string
  onKeywordChange: (value: string) => void
  documentFilter: string
  onDocumentFilterChange: (value: string) => void
  onRefillQuestion: (question: string) => void
  onResendQuestion: (question: string) => void
  resendErrorMessage: string | null
  highlightedChunkId: string | null
  onCitationClick: (chunkId: string) => void
  formatUsd: (value: number) => string
  isResending: boolean
}

const getUsageText = (usage: TokenUsage, estimatedCostUsd?: number, formatUsd?: (value: number) => string) => {
  const usageText = `tokens: prompt=${usage.promptTokens}, completion=${usage.completionTokens}, total=${usage.totalTokens}`
  if (typeof estimatedCostUsd === 'number' && formatUsd) {
    return `${usageText} / 概算コスト: ${formatUsd(estimatedCostUsd)}`
  }
  return usageText
}

const renderCitations = (msgId: string, citations: Citation[], highlightedChunkId: string | null, onCitationClick: (chunkId: string) => void) => (
  <details style={{ marginTop: '0.4rem' }}>
    <summary>根拠（{citations.length}件）</summary>
    <ul>
      {citations.map((citation) => {
        const isHighlighted = citation.chunkId === highlightedChunkId
        const derivedDocId = citation.docId ?? citation.chunkId.split(':')[0]
        return (
          <li
            key={`${msgId}-${citation.chunkId}`}
            style={{
              border: isHighlighted ? '2px solid #1967d2' : '1px solid #ddd',
              background: isHighlighted ? '#eef5ff' : 'transparent',
              borderRadius: '8px',
              padding: '0.5rem',
              marginTop: '0.4rem',
            }}
          >
            <button
              type="button"
              onClick={() => onCitationClick(citation.chunkId)}
              style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.1rem 0.45rem',
                  background: isHighlighted ? '#1967d2' : '#f0f4ff',
                  color: isHighlighted ? '#fff' : '#27408b',
                  borderRadius: '999px',
                }}
              >
                docId: {derivedDocId}
              </span>
              <span>chunkId: {citation.chunkId}</span>
            </button>
            <div>
              page: {citation.pageStart} - {citation.pageEnd}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{citation.quote}</div>
          </li>
        )
      })}
    </ul>
  </details>
)

export function QuestionHistory(props: QuestionHistoryProps) {
  const {
    history,
    selectedDocumentIds,
    keyword,
    onKeywordChange,
    documentFilter,
    onDocumentFilterChange,
    onRefillQuestion,
    onResendQuestion,
    resendErrorMessage,
    highlightedChunkId,
    onCitationClick,
    formatUsd,
    isResending,
  } = props

  const keywordText = keyword.trim().toLowerCase()
  const assistantContents = history
    .filter((item) => item.role === 'assistant')
    .map((item) => item.content.toLowerCase())
    .join('\n')

  const filteredHistory = history.filter((msg) => {
    const matchesKeyword = keywordText === '' || msg.content.toLowerCase().includes(keywordText) || assistantContents.includes(keywordText)
    const matchesDocument = documentFilter === 'all' || selectedDocumentIds.includes(documentFilter)
    return matchesKeyword && matchesDocument
  })

  return (
    <section style={{ marginTop: '2rem' }}>
      <h2>質問履歴</h2>
      {resendErrorMessage && <p style={{ color: '#b00020', marginBottom: '0.75rem' }}>{resendErrorMessage}</p>}
      <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
        <label>
          キーワード検索
          <input value={keyword} onChange={(e) => onKeywordChange(e.target.value)} placeholder="質問・回答を検索" />
        </label>
        <label>
          ドキュメントフィルタ
          <select value={documentFilter} onChange={(e) => onDocumentFilterChange(e.target.value)}>
            <option value="all">すべてのドキュメント</option>
            {selectedDocumentIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredHistory.length === 0 ? (
        <p>条件に一致する履歴はありません。</p>
      ) : (
        <ul>
          {filteredHistory.map((msg) => (
            <li key={msg.id} style={{ marginBottom: '0.75rem' }}>
              <strong>{msg.role}</strong>: {msg.content}
              {msg.role === 'user' && (
                <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => onRefillQuestion(msg.content)}>
                    この質問を再利用
                  </button>
                  <button type="button" onClick={() => onResendQuestion(msg.content)} disabled={isResending}>
                    {isResending ? '再送中…' : 'この質問を再送'}
                  </button>
                </div>
              )}
              {msg.usage && <div style={{ fontSize: '0.9em', marginTop: '0.35rem' }}>{getUsageText(msg.usage, msg.estimatedCostUsd, formatUsd)}</div>}
              {msg.citations && msg.citations.length > 0 && renderCitations(msg.id, msg.citations, highlightedChunkId, onCitationClick)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
