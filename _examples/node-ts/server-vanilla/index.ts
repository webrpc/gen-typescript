import http, { IncomingMessage, ServerResponse } from "node:http"
import { Kind, ExampleServer, createNodeHttpExampleHandler } from "./server.gen"
import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Request Context Implementation
// ---------------------------------------------------------------------------
// This mimics the pattern commonly used in Go, Express, Fastify, etc.

export interface RequestContext {
  id: string            // unique request id
  start: number         // timestamp when request started
  // url: string           // original URL
  // method: string        // HTTP method
  // headers: Record<string, string | string[] | undefined>
  // Arbitrary key/value bag for middleware & handlers
  data: Map<string, unknown>
  // AbortSignal that fires if client disconnects or server cancels work
  abort: AbortSignal
  // Raw IncomingMessage reference (non-enumerable when attached)
  req: IncomingMessage
  set<T = unknown>(key: string, value: T): void
  get<T = unknown>(key: string): T | undefined
}

function createRequestContext(req: IncomingMessage): RequestContext {
  const start = Date.now()
  const urlObj = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const controller = new AbortController()
  const ctx: RequestContext = {
    id: randomUUID(),
    start,
    // url: urlObj.pathname + urlObj.search,
    // method: (req.method || 'GET').toUpperCase(),
    // headers: req.headers as Record<string, string | string[] | undefined>,
    data: new Map(),
    abort: controller.signal,
    req, // will be redefined as non-enumerable below
    set(key, value) { this.data.set(key, value) },
    get(key) { return this.data.get(key) as any },
  }
  // Make req & controller non-enumerable to avoid circular refs / noisy logs
  Object.defineProperty(ctx, 'req', { value: req, enumerable: false, writable: false })
  Object.defineProperty(ctx, '_controller', { value: controller, enumerable: false, writable: false })
  return ctx
}

// Augment IncomingMessage so app code could also access req.ctx directly if desired.
declare module 'node:http' {
  interface IncomingMessage {
    ctx: RequestContext
  }
}

// ---------------------------------------------------------------------------
// Middleware signature with context (pure, explicit)
// ---------------------------------------------------------------------------
type ContextHandler = (ctx: RequestContext, req: IncomingMessage, res: ServerResponse) => Promise<void> | void

// Compose middleware using functional wrappers for clarity & minimal overhead.

// --- Middleware: logging (context-aware) ---
function withLogging<T extends ContextHandler>(next: T): ContextHandler {
  return async (ctx, req, res) => {
    console.log(`[REQ ${ctx.id}] ${ctx.req.method} ${ctx.req.url}`)
    try {
      await next(ctx, req, res)
    } finally {
      const duration = Date.now() - ctx.start
      console.log(`[RES ${ctx.id}] ${ctx.req.method} ${ctx.req.url} -> ${res.statusCode} (${duration}ms)`)    
    }
  }
}

// --- Middleware: simple trace id header example ---
function withTrace<T extends ContextHandler>(next: T): ContextHandler {
  return async (ctx, req, res) => {
    ctx.set('traceId'.toString(), ctx.id) // or store the symbol directly
    await next(ctx, req, res)
    res.setHeader('X-Trace-Id', ctx.id)
  }
}

// --- Main handler (context-aware) ---
async function mainHandler(ctx: RequestContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = ctx.req.url

  // First try RPC routing (/rpc/*)
  if (url?.startsWith('/rpc/')) {
    // Under the hood the generated rpc handler doesn't know about ctx, but our
    // service implementations can access it through AsyncLocalStorage.
    const handled = await rpcHandler(req, res)
    if (handled) return // RPC request fully handled
  }
  switch (url) {
    case "/": {
      res.writeHead(200, { "Content-Type": "text/plain" })
      res.end(`Hello world (req ${ctx.id})\n`)
      return
    }
    case "/json": {
      sendJson(res, 200, { ok: true, time: new Date().toISOString(), reqId: ctx.id })
      return
    }
    default: {
      res.writeHead(404, { "Content-Type": "text/plain" })
      res.end("Not Found\n")
      return
    }
  }
}

// ---------------------------------------------------------------------------
// ExampleServer implementation (in-memory demo)
// ---------------------------------------------------------------------------
const exampleService: ExampleServer<RequestContext> = {
  async ping(ctx) {
    ctx.set('pingedAt', new Date().toISOString())
    return {}
  },
  async getUser(ctx, { userId }) {
    return {
      code: 200,
      user: {
        id: userId,
        USERNAME: `user-${userId}`,
        role: Kind.USER,
        meta: { env: 'dev', traceId: ctx.get('traceId') },
      }
    }
  },
  async getArticle(ctx, { articleId }) {
    return {
      title: `Article ${articleId}`,
      content: `Hello, this is the content for article ${articleId}. (req ${ctx.id})`
    }
  }
}

// RPC handler factory – we capture the ctx created per request and supply it directly.
let rpcHandler: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>

// Simple JSON helper (typed) – narrows headers & body
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload)
  })
  res.end(payload)
}

// --- Compose middleware chain & start server ---
const handler: ContextHandler = withLogging(withTrace(mainHandler))

http.createServer(async (req, res) => {
  const ctx = createRequestContext(req)
  req.ctx = ctx
  // Build rpc handler lazily per request with current ctx
  rpcHandler = createNodeHttpExampleHandler(exampleService, () => ctx)
  const abort = () => {
    const controller: AbortController | undefined = (ctx as any)._controller
    if (controller && !controller.signal.aborted) controller.abort()
  }
  req.on('aborted', abort)
  res.on('close', abort)
  try {
    await handler(ctx, req, res)
  } catch (err: any) {
    console.error(`[ERR ${ctx.id}]`, err?.message || err)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
    }
    if (!res.writableEnded) {
      const body = ctx.abort.aborted
        ? { msg: 'client closed request', reqId: ctx.id }
        : { msg: 'internal error', reqId: ctx.id }
      res.end(JSON.stringify(body))
    }
  }
}).listen(3000, () => {
  console.log("Server running at http://localhost:3000/ (context-enabled)")
})
