import http, { IncomingMessage, ServerResponse } from 'node:http'
import { HttpHandler, createWebrpcServerHandler, RequestContext, createRequestContext, sendJson } from './helpers'
import { Kind, ExampleServer, serveExampleRpc } from './server.gen'
import { randomUUID } from 'node:crypto'

// --- Middleware: logging (context-aware) ---
function withLogging(next: HttpHandler): HttpHandler {
  return async (ctx, req, res) => {
    const traceId = ctx.reqId
    console.log(`[REQ ${traceId}] ${req.method} ${req.url}`)
    try {
      await next(ctx, req, res)
    } finally {
      const end = performance.now()
      const durationMs = end - ctx.start
      console.log(`[RES ${traceId}] ${req.method} ${req.url} -> ${res.statusCode} (${durationMs.toFixed(3)}ms)`)
    }
  }
}

// --- Middleware: simple trace id header example ---
function withTrace(next: HttpHandler): HttpHandler {
  return async (ctx, req, res) => {
    ctx.set('traceId', randomUUID())
    await next(ctx, req, res)
    if (!res.headersSent) {
      res.setHeader('X-Trace-Id', ctx.reqId)
    }
  }
}

// --- Main handler factory (returns context-aware handler) ---
function mainHandler(): HttpHandler {
  const rpcHandler = createWebrpcServerHandler(exampleService, serveExampleRpc)

  // Return the actual request handler (async because we use await inside)
  return async (ctx: RequestContext, req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = req.url

    // First try RPC routing (/rpc/*)
    if (url?.startsWith('/rpc/')) {
      await rpcHandler(ctx, req, res)
      return
    }

    // Other routes
    switch (url) {
      case "/": {
        res.writeHead(200, { "Content-Type": "text/plain" })
        res.end(`Hello world`)// (req ${ctx.var.traceId})\n`)
        return
      }
      case "/json": {
        sendJson(res, 200, { ok: true, time: new Date().toISOString() })//, traceId: ctx.var.traceId })
        return
      }
      default: {
        res.writeHead(404, { "Content-Type": "text/plain" })
        res.end("Not Found\n")
        return
      }
    }
  }
}

// ---------------------------------------------------------------------------
// ExampleServer implementation (in-memory demo)
// ---------------------------------------------------------------------------
const exampleService: ExampleServer<RequestContext> = {
  async ping() {
    return {}
  },
  async getUser(ctx, { userId }) {
    const traceId = ctx.get<string>('traceId') || ''
    return {
      code: 200,
      user: {
        id: userId,
        USERNAME: `user-${userId}`,
        role: Kind.USER,
        meta: { env: 'dev', reqId: ctx.reqId, traceId },
      }
    }
  },
  async getArticle(ctx, { articleId }) {
    return {
      title: `Article ${articleId}`,
      content: `Hello, this is the content for article ${articleId}. (req ${ctx.reqId})`
    }
  }
}

// --- Compose middleware chain & start server ---
// Build the base handler once (could rebuild per request if needed)
const handler: HttpHandler = withLogging(withTrace(mainHandler()))

http.createServer(async (req, res) => {
  const ctx = createRequestContext()

  const abort = () => {
    const controller: AbortController | undefined = (ctx as any)._controller
    if (controller && !controller.signal.aborted) controller.abort()
  }
  req.on('aborted', abort)
  res.on('close', abort)

  try {
    await handler(ctx, req, res)
  } catch (err: any) {
    console.error(`[ERR ${ctx.reqId}]`, err?.message || err)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
    }
    if (!res.writableEnded) {
      const body = ctx.abort.aborted
        ? { msg: 'client closed request', reqId: ctx.reqId }
        : { msg: 'internal error', reqId: ctx.reqId }
      res.end(JSON.stringify(body))
    }
  }
}).listen(3000, () => {
  console.log("Server running at http://localhost:3000/")
})
