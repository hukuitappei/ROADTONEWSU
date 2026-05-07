import { NextResponse } from 'next/server'
import type { ApiError, ApiErrorCode } from '@/types/api'

export const jsonError = (code: ApiErrorCode, message: string, status: number, details?: Record<string, unknown>) => {
  const body: ApiError = { error: { code, message, details } }
  return NextResponse.json(body, { status })
}
