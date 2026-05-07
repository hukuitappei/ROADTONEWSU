import { NextResponse } from 'next/server'
import type { ApiError, ApiErrorCode } from '@/types/api'

export const jsonError = (code: ApiErrorCode, message: string, status: number, details?: Record<string, unknown>) => {
  const body: ApiError = { error: { code, message, details } }
  return NextResponse.json(body, { status })
}

export const mapProviderStatusToApiError = (status: number) => {
  if (status === 429) {
    return {
      code: 'RATE_LIMITED' as const,
      message: 'リクエストが集中しています。しばらく待ってから再試行してください。',
      status: 429,
    }
  }

  if (status === 400 || status === 404 || status === 422) {
    return {
      code: 'BAD_REQUEST' as const,
      message: '入力内容に誤りがあります。内容を確認してください。',
      status: 400,
    }
  }

  return {
    code: 'INTERNAL_ERROR' as const,
    message: 'サーバーエラーが発生しました。時間をおいて再試行してください。',
    status: 500,
  }
}

type ProviderErrorCause = { status?: number; code?: string }

export const mapProviderErrorToApiError = (cause?: ProviderErrorCause) => {
  if (typeof cause?.status === 'number') {
    return mapProviderStatusToApiError(cause.status)
  }

  if (cause?.code === 'provider_network_error' || cause?.code === 'provider_unavailable') {
    return {
      code: 'INTERNAL_ERROR' as const,
      message: 'サーバーエラーが発生しました。時間をおいて再試行してください。',
      status: 500,
    }
  }

  return {
    code: 'INTERNAL_ERROR' as const,
    message: 'サーバーエラーが発生しました。時間をおいて再試行してください。',
    status: 500,
  }
}
