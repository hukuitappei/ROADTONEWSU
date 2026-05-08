import { getRequestUserId, requireUserId } from '@/lib/auth'

const req = (userId?: string) =>
  ({
    headers: {
      get: (key: string) => (key === 'x-user-id' ? userId ?? null : null),
    },
  }) as unknown as Request

describe('auth helpers', () => {
  test('getRequestUserId returns null when missing', () => expect(getRequestUserId(req())).toBeNull())
  test('getRequestUserId trims value', () => expect(getRequestUserId(req('  abc  '))).toBe('abc'))
  test('getRequestUserId empty to null', () => expect(getRequestUserId(req('   '))).toBeNull())
  test('getRequestUserId rejects too long', () => expect(getRequestUserId(req('a'.repeat(129)))).toBeNull())

  test('requireUserId ok true with value', () => {
    const result = requireUserId(req('u1'))
    expect(result.ok).toBe(true)
  })

  test('requireUserId returns error when missing', async () => {
    const result = requireUserId(req())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect((result.response as unknown as { status: number }).status).toBe(400)
      const json = await (result.response as unknown as { json: () => Promise<{ error: { details: { field: string } } }> }).json()
      expect(json.error.details.field).toBe('x-user-id')
    }
  })

  test('requireUserId rejects blank', () => expect(requireUserId(req(' ')).ok).toBe(false))
  test('requireUserId rejects too long', () => expect(requireUserId(req('a'.repeat(129))).ok).toBe(false))
  test('requireUserId accepts 128 chars', () => expect(requireUserId(req('a'.repeat(128))).ok).toBe(true))
  test('getRequestUserId accepts symbols', () => expect(getRequestUserId(req('user-1_test'))).toBe('user-1_test'))
  test('getRequestUserId preserves case', () => expect(getRequestUserId(req('UserA'))).toBe('UserA'))
  test('requireUserId returns userId payload', () => {
    const result = requireUserId(req('abc'))
    expect(result.ok && result.userId).toBe('abc')
  })
  test('missing non-target header unaffected', () => expect(getRequestUserId(({ headers: { get: () => null } } as unknown as Request))).toBeNull())
  test('trim tabs/newlines', () => expect(getRequestUserId(req('\n\tabc\t'))).toBe('abc'))
})
