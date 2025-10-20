import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebrpcHeader, WebrpcHeaderValue } from './server.gen'

export type HttpHandler<C = RequestContext> = (ctx: C, req: IncomingMessage, res: ServerResponse) => Promise<void>

export interface RequestContext {
  // request id
  reqId: string

  // timestamp when request started
  start: number

  // AbortSignal that fires if client disconnects or server cancels work
  abort: AbortSignal
  
  // Arbitrary key/value bag for middleware & handlers
  data: Map<string, unknown>
  set<T = unknown>(key: string, value: T): void
  get<T = unknown>(key: string): T | undefined

  // internal abort controller instance (non-enumerable at runtime)
  _controller?: AbortController
}

export function createRequestContext(): RequestContext {
  const start = performance.now()
  const controller = new AbortController()
  const ctx: RequestContext = {
    reqId: randomUUID(),
    start,
    abort: controller.signal,
    data: new Map(),
    set(key, value) { this.data.set(key, value) },
    get(key) { return this.data.get(key) as any },
  }

  // Make _controller non-enumerable to keep logs clean
  Object.defineProperty(ctx, '_controller', { value: controller, enumerable: false, writable: false })

  return ctx
}

// Attempting higher-kinded types like `Service<T> = T<RequestContext>` isn't supported in TS.
// Instead define an explicit function shape for the RPC serving helper when context is RequestContext.
export interface WebrpcResult {
  method: string
  status: number
  headers: Record<string, string>
  body: any
}

// Function that, given a service + ctx + url + body, either handles the RPC and returns a result, or null if pattern mismatch.
export type ServeWebrpcFn<S, C extends RequestContext> = (service: S, ctx: C, urlPath: string, body: any) => Promise<WebrpcResult | null>


export function createWebrpcServerHandler<S, C extends RequestContext>(service: S, serveRpc: ServeWebrpcFn<S, C>): HttpHandler<C> {
  return async function handler(ctx: C, req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || ''
    if (!url.startsWith('/rpc/')) return // not our RPC route; caller will continue

    // Accept both GET & POST/PUT/PATCH for simplicity (GET => empty object)
    const methodVerb = (req.method || 'GET').toUpperCase()
    let rawBody = ''
    if (methodVerb === 'POST' || methodVerb === 'PUT' || methodVerb === 'PATCH') {
      rawBody = await new Promise<string>((resolve, reject) => {
        let data = ''
        req.on('data', (chunk: Buffer) => { data += chunk.toString('utf8') })
        req.on('end', () => resolve(data))
        req.on('error', reject)
      })
    }

    let parsed: any = {}
    if (rawBody.length > 0) {
      try {
        parsed = JSON.parse(rawBody)
      } catch (e: any) {
        const status = 400
        const body = { msg: 'invalid JSON body', status, code: '' }
        res.writeHead(status, { [WebrpcHeader]: WebrpcHeaderValue, 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
        return
      }
    }

    const result = await serveRpc(service, ctx, url, parsed)
    if (result == null) return // pattern mismatch (shouldn't happen due to prefix check)

    const payload = JSON.stringify(result.body ?? {})
    res.writeHead(result.status, {
      ...result.headers,
      'Content-Length': Buffer.byteLength(payload)
    })
    res.end(payload)
  }
}

// Simple JSON helper (typed) – narrows headers & body
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload)
  })
  res.end(payload)
}
