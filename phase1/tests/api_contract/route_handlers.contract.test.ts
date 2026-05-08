import { beforeEach, describe, expect, it, vi } from 'vitest'

const validUuid = '123e4567-e89b-12d3-a456-426614174000'

const parseJson = async (res: Response) => (await res.json()) as { error?: { code: string; details?: unknown } }

beforeEach(() => {
  vi.resetModules()
})

describe('API contract: route handlers', () => {
  it('chat: invalid_json -> 400 BAD_REQUEST with details', async () => {
    const { POST } = await import('@/app/api/chat/route')
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid',
    })

    const res = await POST(req)
    const body = await parseJson(res)

    expect(res.status).toBe(400)
    expect(body.error?.code).toBe('BAD_REQUEST')
    expect(body.error?.details).toEqual({ field: 'body', reason: 'invalid_json' })
  })

  it('chat: invalid UUID sessionId -> 400 BAD_REQUEST', async () => {
    const { POST } = await import('@/app/api/chat/route')
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'not-uuid', message: 'hello' }),
    })

    const res = await POST(req)
    const body = await parseJson(res)

    expect(res.status).toBe(400)
    expect(body.error?.code).toBe('BAD_REQUEST')
    expect(body.error?.details).toEqual({ field: 'sessionId', reason: 'invalid_format' })
  })

  it('sessions: invalid limit range -> 400 BAD_REQUEST', async () => {
    const { GET } = await import('@/app/api/sessions/route')
    const req = new Request('http://localhost/api/sessions?limit=999', { method: 'GET' })

    const res = await GET(req)
    const body = await parseJson(res)

    expect(res.status).toBe(400)
    expect(body.error?.code).toBe('BAD_REQUEST')
    expect(body.error?.details).toEqual({ field: 'limit', reason: 'invalid_range' })
  })

  it('upload: invalid MIME -> 400 BAD_REQUEST', async () => {
    const { POST } = await import('@/app/api/upload/route')
    const form = new FormData()
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'a.txt', { type: 'text/plain' }))

    const req = new Request('http://localhost/api/upload', { method: 'POST', body: form })
    const res = await POST(req)
    const body = await parseJson(res)

    expect(res.status).toBe(400)
    expect(body.error?.code).toBe('BAD_REQUEST')
    expect(body.error?.details).toEqual({ field: 'file', reason: 'invalid_mime' })
  })

  it('upload: file size overflow -> 413 PAYLOAD_TOO_LARGE', async () => {
    const { POST } = await import('@/app/api/upload/route')
    const over = new Uint8Array(10 * 1024 * 1024 + 1)
    const form = new FormData()
    form.append('file', new File([over], 'a.pdf', { type: 'application/pdf' }))

    const req = new Request('http://localhost/api/upload', { method: 'POST', body: form })
    const res = await POST(req)
    const body = await parseJson(res)

    expect(res.status).toBe(413)
    expect(body.error?.code).toBe('PAYLOAD_TOO_LARGE')
    expect(body.error?.details).toEqual({ maxBytes: 10 * 1024 * 1024 })
  })

  it('sessions/[id]: not found -> 404 NOT_FOUND', async () => {
    vi.doMock('@/lib/repository', async () => {
      const actual = await vi.importActual<object>('@/lib/repository')
      return { ...actual, getSession: vi.fn(async () => null) }
    })

    const { GET } = await import('@/app/api/sessions/[id]/route')
    const res = await GET(new Request('http://localhost/api/sessions/' + validUuid), { params: { id: validUuid } })
    const body = await parseJson(res)

    expect(res.status).toBe(404)
    expect(body.error?.code).toBe('NOT_FOUND')
    expect(body.error?.details).toEqual({ field: 'id', reason: 'not_found' })
  })

  it('documents/[id]: invalid UUID -> 400 BAD_REQUEST', async () => {
    const { GET } = await import('@/app/api/documents/[id]/route')
    const res = await GET(new Request('http://localhost/api/documents/bad-id'), { params: { id: 'bad-id' } })
    const body = await parseJson(res)

    expect(res.status).toBe(400)
    expect(body.error?.code).toBe('BAD_REQUEST')
    expect(body.error?.details).toEqual({ field: 'id', reason: 'invalid_format' })
  })

  it('chat: provider 429 -> 503 SERVICE_UNAVAILABLE', async () => {
    vi.doMock('@/lib/repository', async () => {
      const actual = await vi.importActual<object>('@/lib/repository')
      return { ...actual, getSession: vi.fn(async () => ({ id: validUuid })), addMessage: vi.fn(async () => ({ id: validUuid })) }
    })
    vi.doMock('@/lib/llm', () => ({ generateAnswer: vi.fn(async () => { throw { cause: { status: 429 } } }), streamAnswer: vi.fn() }))

    const { POST } = await import('@/app/api/chat/route')
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: validUuid, message: 'hello', stream: false }),
    })
    const res = await POST(req)
    const body = await parseJson(res)

    expect(res.status).toBe(503)
    expect(body.error?.code).toBe('SERVICE_UNAVAILABLE')
  })

  it('chat: provider 5xx -> 502 UPSTREAM_ERROR', async () => {
    vi.doMock('@/lib/repository', async () => {
      const actual = await vi.importActual<object>('@/lib/repository')
      return { ...actual, getSession: vi.fn(async () => ({ id: validUuid })), addMessage: vi.fn(async () => ({ id: validUuid })) }
    })
    vi.doMock('@/lib/llm', () => ({ generateAnswer: vi.fn(async () => { throw { cause: { status: 500 } } }), streamAnswer: vi.fn() }))

    const { POST } = await import('@/app/api/chat/route')
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: validUuid, message: 'hello', stream: false }),
    })
    const res = await POST(req)
    const body = await parseJson(res)

    expect(res.status).toBe(502)
    expect(body.error?.code).toBe('UPSTREAM_ERROR')
  })
})
