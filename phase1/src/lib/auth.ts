import { jsonError } from '@/lib/http'

const USER_ID_HEADER = 'x-user-id'

// NOTE: `x-user-id` is a temporary pseudo-auth mechanism for Phase 1 only.
// It does NOT provide real identity verification and must not be treated as proof of user identity.
// Security-wise, this value is untrusted input from the request, not a trusted ID for authorization.
// TODO(phase2-auth): replace x-user-id with Supabase Auth JWT verification.

export const getRequestUserId = (req: Request): string | null => {
  const userId = req.headers.get(USER_ID_HEADER)?.trim()
  if (!userId) return null
  if (userId.length > 128) return null
  return userId
}

// Auth boundary for API routes in Phase 1.
// `requireUserId` only checks presence/format of `x-user-id` and does not authenticate the caller.
// Planned replacement in Phase 2: Supabase Auth with JWT verification.
export const requireUserId = (req: Request): { ok: true; userId: string } | { ok: false; response: Response } => {
  const userId = getRequestUserId(req)
  if (!userId) {
    return {
      ok: false,
      response: jsonError('BAD_REQUEST', '認証情報が不足しています。', 400, {
        field: USER_ID_HEADER,
        reason: 'required',
      }),
    }
  }

  return { ok: true, userId }
}
