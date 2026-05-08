import { jsonError } from '@/lib/http'

const USER_ID_HEADER = 'x-user-id'

export const getRequestUserId = (req: Request): string | null => {
  const userId = req.headers.get(USER_ID_HEADER)?.trim()
  if (!userId) return null
  if (userId.length > 128) return null
  return userId
}

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
