import { jsonError } from '@/lib/http'
import { createSupabaseServiceClient } from '@/lib/supabase'

const WINDOW_SECONDS = 60
const MAX_REQUESTS_PER_WINDOW = 30
const MAX_CONCURRENT_REQUESTS = 3

const getUserKey = (req: Request): string => {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwardedFor) return `ip:${forwardedFor}`

  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return `ip:${realIp}`

  return 'anonymous'
}

const rateLimitedResponse = () =>
  jsonError('RATE_LIMITED', 'リクエストが集中しています。しばらく待ってから再試行してください。', 429)

export async function withUserRateLimit(req: Request, handler: () => Promise<Response>): Promise<Response> {
  const key = getUserKey(req)
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.rpc('consume_api_rate_limit', {
    p_key: key,
    p_window_seconds: WINDOW_SECONDS,
    p_max_requests: MAX_REQUESTS_PER_WINDOW,
    p_max_concurrent: MAX_CONCURRENT_REQUESTS,
  })

  if (error) return jsonError('INTERNAL_ERROR', 'サーバーエラーが発生しました。時間をおいて再試行してください。', 500)
  if (!data?.[0]?.allowed) return rateLimitedResponse()

  try {
    return await handler()
  } finally {
    await supabase.rpc('release_api_rate_limit', { p_key: key })
  }
}
