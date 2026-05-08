import { jsonError, mapProviderErrorToApiError, mapProviderStatusToApiError } from '@/lib/http'

describe('http helpers', () => {
  test('jsonError sets status', async () => {
    const res = jsonError('BAD_REQUEST', 'x', 400)
    expect((res as unknown as { status: number }).status).toBe(400)
    const body = await (res as unknown as { json: () => Promise<{ error: { code: string } }> }).json()
    expect(body.error.code).toBe('BAD_REQUEST')
  })

  test('map status 429', () => expect(mapProviderStatusToApiError(429).code).toBe('RATE_LIMITED'))
  test('map status 400', () => expect(mapProviderStatusToApiError(400).code).toBe('BAD_REQUEST'))
  test('map status 404', () => expect(mapProviderStatusToApiError(404).code).toBe('BAD_REQUEST'))
  test('map status 422', () => expect(mapProviderStatusToApiError(422).code).toBe('BAD_REQUEST'))
  test('map status 500 fallback', () => expect(mapProviderStatusToApiError(500).code).toBe('INTERNAL_ERROR'))

  test('map cause status has priority', () => expect(mapProviderErrorToApiError({ status: 429, code: 'provider_unavailable' }).code).toBe('RATE_LIMITED'))
  test('map network code internal', () => expect(mapProviderErrorToApiError({ code: 'provider_network_error' }).code).toBe('INTERNAL_ERROR'))
  test('map unavailable code internal', () => expect(mapProviderErrorToApiError({ code: 'provider_unavailable' }).code).toBe('INTERNAL_ERROR'))
  test('map unknown cause internal', () => expect(mapProviderErrorToApiError({ code: 'x' }).code).toBe('INTERNAL_ERROR'))
  test('map undefined cause internal', () => expect(mapProviderErrorToApiError().code).toBe('INTERNAL_ERROR'))
  test('map status 503 internal', () => expect(mapProviderErrorToApiError({ status: 503 }).code).toBe('INTERNAL_ERROR'))
})
