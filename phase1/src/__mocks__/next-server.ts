export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit): Response {
    const headers = new Headers(init?.headers as HeadersInit | undefined)
    headers.set('content-type', 'application/json')
    return new Response(JSON.stringify(body), { ...init, headers })
  }
}
