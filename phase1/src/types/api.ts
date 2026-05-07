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

// --- Sessions list ---

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

// --- Document detail ---

export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'error'

export type DocumentDetail = {
  id: string
  sessionId: string
  fileName: string
  status: DocumentStatus
  qaEnabled: boolean
  summary: string | null
  pageCount: number | null
  charCount: number | null
  createdAt: string
  updatedAt: string
}

export type DocumentDetailResponse = {
  document: DocumentDetail
}

// --- Session detail ---

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
