export type ApiErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'PAYLOAD_TOO_LARGE' | 'RATE_LIMITED' | 'INTERNAL_ERROR'

export type ApiError = {
  error: {
    code: ApiErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

export type Citation = {
  chunkId: string
  pageStart: number
  pageEnd: number
  quote: string
}

export type ChatRequest = {
  sessionId: string
  message: string
  documentIds?: string[]
  stream?: boolean
}

export type ChatResponse = {
  messageId: string
  sessionId: string
  role: 'assistant'
  content: string
  citations: Citation[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  createdAt: string
}

export type SessionListItem = {
  id: string
  title: string
  lastMessageAt: string
  createdAt: string
}

export type SessionsListResponse = {
  items: SessionListItem[]
  nextCursor: string | null
}

export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'error'

export type DocumentDetail = {
  id: string
  sessionId: string
  fileName: string
  status: DocumentStatus
  qaEnabled: boolean
  summary: string | null
  errorMessage: string | null
  pageCount: number | null
  charCount: number | null
  exceedsQaLimit: boolean
  createdAt: string
  updatedAt: string
}

export type DocumentDetailResponse = {
  document: DocumentDetail
}

export type SessionDetail = {
  id: string
  title: string
  createdAt: string
}

export type DocumentSummary = {
  id: string
  fileName: string
  status: DocumentStatus
  qaEnabled: boolean
  summary: string | null
  createdAt: string
}

export type MessageItem = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type SessionDetailResponse = {
  session: SessionDetail
  documents: DocumentSummary[]
  messages: MessageItem[]
  hasMore: boolean
}

export type DbSessionRow = { id: string; title: string | null; created_at: string | null }
export type DbMessageRow = { id: string; session_id: string; role: 'user' | 'assistant'; content: string | null; created_at: string | null }
export type DbDocumentRow = {
  id: string
  session_id: string
  filename: string
  storage_path: string | null
  status: DocumentStatus
  summary: string | null
  page_count: number | null
  char_count: number | null
  qa_enabled: boolean | null
  error_message: string | null
  created_at: string | null
  updated_at: string | null
}

const toIso = (v: string | null | undefined) => v ?? new Date(0).toISOString()
const normalizeTitle = (title: string | null | undefined) => title?.trim() || 'Untitled Session'

export const mapDbSessionToSessionDetail = (row: DbSessionRow): SessionDetail => ({
  id: row.id,
  title: normalizeTitle(row.title),
  createdAt: toIso(row.created_at),
})

export const mapDbMessageToMessageItem = (row: DbMessageRow): MessageItem => ({
  id: row.id,
  role: row.role,
  content: row.content ?? '',
  createdAt: toIso(row.created_at),
})

export const mapDbDocumentToDetail = (row: DbDocumentRow): DocumentDetail => ({
  id: row.id,
  sessionId: row.session_id,
  fileName: row.filename,
  status: row.status,
  qaEnabled: row.qa_enabled ?? row.status === 'ready',
  summary: row.summary,
  errorMessage: row.error_message,
  pageCount: row.page_count,
  charCount: row.char_count,
  exceedsQaLimit: (row.page_count ?? 0) > 30 || (row.char_count ?? 0) > 80_000,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
})

export const mapDbDocumentToSummary = (row: DbDocumentRow): DocumentSummary => ({
  id: row.id,
  fileName: row.filename,
  status: row.status,
  qaEnabled: row.qa_enabled ?? row.status === 'ready',
  summary: row.summary,
  createdAt: toIso(row.created_at),
})
