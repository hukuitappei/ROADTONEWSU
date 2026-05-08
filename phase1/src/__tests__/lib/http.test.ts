import { mapProviderStatusToApiError, mapProviderErrorToApiError } from '@/lib/http'

describe('mapProviderStatusToApiError', () => {
  it('maps 429 to RATE_LIMITED with status 429', () => {
    const result = mapProviderStatusToApiError(429)
    expect(result.code).toBe('RATE_LIMITED')
    expect(result.status).toBe(429)
  })

  it('maps 400 to BAD_REQUEST with status 400', () => {
    const result = mapProviderStatusToApiError(400)
    expect(result.code).toBe('BAD_REQUEST')
    expect(result.status).toBe(400)
  })

  it('maps 404 to BAD_REQUEST', () => {
    expect(mapProviderStatusToApiError(404).code).toBe('BAD_REQUEST')
  })

  it('maps 422 to BAD_REQUEST', () => {
    expect(mapProviderStatusToApiError(422).code).toBe('BAD_REQUEST')
  })

  it('maps 500 to INTERNAL_ERROR with status 500', () => {
    const result = mapProviderStatusToApiError(500)
    expect(result.code).toBe('INTERNAL_ERROR')
    expect(result.status).toBe(500)
  })

  it('maps unrecognized status to INTERNAL_ERROR', () => {
    const result = mapProviderStatusToApiError(503)
    expect(result.code).toBe('INTERNAL_ERROR')
    expect(result.status).toBe(500)
  })
})

describe('mapProviderErrorToApiError', () => {
  it('delegates to status mapping when cause has a status', () => {
    expect(mapProviderErrorToApiError({ status: 429 }).code).toBe('RATE_LIMITED')
    expect(mapProviderErrorToApiError({ status: 400 }).code).toBe('BAD_REQUEST')
  })

  it('returns INTERNAL_ERROR for provider_network_error', () => {
    const result = mapProviderErrorToApiError({ code: 'provider_network_error' })
    expect(result.code).toBe('INTERNAL_ERROR')
    expect(result.status).toBe(500)
  })

  it('returns INTERNAL_ERROR for provider_unavailable', () => {
    const result = mapProviderErrorToApiError({ code: 'provider_unavailable' })
    expect(result.code).toBe('INTERNAL_ERROR')
    expect(result.status).toBe(500)
  })

  it('returns INTERNAL_ERROR when cause is undefined', () => {
    expect(mapProviderErrorToApiError(undefined).code).toBe('INTERNAL_ERROR')
  })

  it('returns INTERNAL_ERROR for unknown error code', () => {
    expect(mapProviderErrorToApiError({ code: 'unknown' }).code).toBe('INTERNAL_ERROR')
  })
})
