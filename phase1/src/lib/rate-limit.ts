import { jsonError } from '@/lib/http'

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 30
const MAX_CONCURRENT_REQUESTS = 3

type UserBucket = {
  windowStart: number
  requestCount: number
  inFlight: number
}

const buckets = new Map<string, UserBucket>()

// x-user-id は認証未実装のためクライアントが自由に偽装できる。
// Vercel/CDN が付与するヘッダーのみを信頼する。
const getUserKey = (req: Request): string => {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwardedFor) return `ip:${forwardedFor}`

  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return `ip:${realIp}`

  return 'anonymous'
}

const cleanStaleBuckets = () => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= WINDOW_MS * 2) buckets.delete(key)
  }
}

const getBucket = (key: string): UserBucket => {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    const renewed: UserBucket = { windowStart: now, requestCount: 0, inFlight: 0 }
    buckets.set(key, renewed)
    if (Math.random() < 0.01) cleanStaleBuckets()
    return renewed
  }
  return existing
}

const rateLimitedResponse = () =>
  jsonError('RATE_LIMITED', 'リクエストが集中しています。しばらく待ってから再試行してください。', 429)

export async function withUserRateLimit(req: Request, handler: () => Promise<Response>): Promise<Response> {
  const key = getUserKey(req)
  const bucket = getBucket(key)

  if (bucket.requestCount >= MAX_REQUESTS_PER_WINDOW) return rateLimitedResponse()
  if (bucket.inFlight >= MAX_CONCURRENT_REQUESTS) return rateLimitedResponse()

  bucket.requestCount += 1
  bucket.inFlight += 1

  try {
    return await handler()
  } finally {
    bucket.inFlight = Math.max(0, bucket.inFlight - 1)
  }
}
