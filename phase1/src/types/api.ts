export type ApiErrorCode = 'BAD_REQUEST' | 'PAYLOAD_TOO_LARGE' | 'RATE_LIMITED' | 'INTERNAL_ERROR'

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
