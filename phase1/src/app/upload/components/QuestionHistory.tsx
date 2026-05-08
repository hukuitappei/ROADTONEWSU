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
            <button type="button" onClick={() => onCitationClick(citation.chunkId)} style={{ marginBottom: '0.35rem' }}>
              chunkId: {citation.chunkId}
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
    highlightedChunkId,
    onCitationClick,
    formatUsd,
    isResending,
  } = props

  const filteredHistory = history.filter((msg) => {
    const matchesKeyword = keyword.trim() === '' || msg.content.toLowerCase().includes(keyword.trim().toLowerCase())
    const matchesDocument = documentFilter === 'all' || selectedDocumentIds.includes(documentFilter)
    return matchesKeyword && matchesDocument
  })

  return (
    <section style={{ marginTop: '2rem' }}>
      <h2>質問履歴</h2>
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
                    {isResending ? '再送中…' : '再送'}
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
