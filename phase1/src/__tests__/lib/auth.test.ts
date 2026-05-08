import { getRequestUserId, requireUserId } from '@/lib/auth'

const makeRequest = (userId?: string) =>
  new Request('http://localhost/', {
    headers: userId !== undefined ? { 'x-user-id': userId } : {},
  })

describe('getRequestUserId', () => {
  it('returns userId from a valid header', () => {
    expect(getRequestUserId(makeRequest('user-123'))).toBe('user-123')
  })

  it('trims whitespace from the header value', () => {
    expect(getRequestUserId(makeRequest('  user-123  '))).toBe('user-123')
  })

  it('returns null when header is absent', () => {
    expect(getRequestUserId(makeRequest())).toBeNull()
  })

  it('returns null for empty string header', () => {
    expect(getRequestUserId(makeRequest(''))).toBeNull()
  })

  it('returns null when userId exceeds 128 characters', () => {
    expect(getRequestUserId(makeRequest('a'.repeat(129)))).toBeNull()
  })

  it('accepts userId of exactly 128 characters', () => {
    const userId = 'a'.repeat(128)
    expect(getRequestUserId(makeRequest(userId))).toBe(userId)
  })
})

describe('requireUserId', () => {
  it('returns ok=true with userId for a valid header', () => {
    const result = requireUserId(makeRequest('user-123'))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userId).toBe('user-123')
  })

  it('returns ok=false when header is absent', () => {
    expect(requireUserId(makeRequest()).ok).toBe(false)
  })

  it('returns a Response instance when ok=false', () => {
    const result = requireUserId(makeRequest())
    if (!result.ok) expect(result.response).toBeInstanceOf(Response)
  })

  it('returns ok=false for oversized userId', () => {
    expect(requireUserId(makeRequest('a'.repeat(129))).ok).toBe(false)
  })
})
