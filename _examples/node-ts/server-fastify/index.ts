import Fastify from 'fastify'
import type { FastifyRequest, FastifyReply, FastifyError } from 'fastify'
import { AsyncLocalStorage } from 'node:async_hooks'
import { Kind, ExampleServer, handleExampleRpc } from './server.gen'

// ---------------------------------------------------------------------------
// Request Context Implementation
// ---------------------------------------------------------------------------
// We use AsyncLocalStorage to provide a per-request context accessible from
// anywhere in the call stack (including service methods) without altering the
// generated server handler signatures. This mimics the pattern commonly used in
// Go, Express, Fastify, etc.

export interface RequestContext {
  id: string            // unique request id
  start: number         // timestamp when request started
  url: string           // original URL
  method: string        // HTTP method
  headers: Record<string, string | string[] | undefined>
  // Arbitrary key/value bag for middleware & handlers
  data: Map<string, unknown>
  set<T = unknown>(key: string, value: T): void
  get<T = unknown>(key: string): T | undefined
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>()

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore()
}

let reqCounter = 0
function createRequestContext(req: FastifyRequest): RequestContext {
  const ctx: RequestContext = {
    id: (++reqCounter).toString(36),
    start: Date.now(),
    url: req.url || '/',
    method: (req.method || 'GET').toUpperCase(),
    headers: req.headers as Record<string, string | string[] | undefined>,
    data: new Map(),
    set(key, value) { this.data.set(key, value) },
    get(key) { return this.data.get(key) as any },
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Middleware signature with context
// ---------------------------------------------------------------------------
type ContextHandler = (ctx: RequestContext, req: FastifyRequest, reply: FastifyReply) => Promise<void> | void

// Compose middleware using functional wrappers for clarity & minimal overhead.

// --- Middleware: logging (context-aware) ---
function withLogging<T extends ContextHandler>(next: T): ContextHandler {
  return async (ctx, req, reply) => {
    console.log(`[REQ ${ctx.id}] ${ctx.method} ${ctx.url}`)
    try {
      await next(ctx, req, reply)
    } finally {
      const duration = Date.now() - ctx.start
      // reply.statusCode might still be 200 if not set; Fastify keeps it.
      console.log(`[RES ${ctx.id}] ${ctx.method} ${ctx.url} -> ${reply.statusCode} (${duration}ms)`)    
    }
  }
}

// --- Middleware: simple trace id header example ---
function withTrace<T extends ContextHandler>(next: T): ContextHandler {
  return async (ctx, req, reply) => {
    ctx.set('traceId', ctx.id)
    await next(ctx, req, reply)
    reply.header('X-Trace-Id', ctx.get('traceId') || ctx.id)
  }
}

// --- Main handler (context-aware) ---
async function mainHandler(ctx: RequestContext, req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const url = ctx.url
  switch (url) {
    case '/': {
      reply.type('text/plain').send(`Hello world (req ${ctx.id})\n`)
      return
    }
    case '/json': {
      reply.send({ ok: true, time: new Date().toISOString(), reqId: ctx.id })
      return
    }
    default: {
      reply.code(404).type('text/plain').send('Not Found\n')
      return
    }
  }
}

// ---------------------------------------------------------------------------
// ExampleServer implementation (in-memory demo)
// ---------------------------------------------------------------------------
const exampleService: ExampleServer = {
  async ping() { 
    // Demonstrate ctx access inside service
    const ctx = getRequestContext()
    ctx?.set('pingedAt', new Date().toISOString())
    return {} 
  },
  async getUser({ userId }) {
    const ctx = getRequestContext()
    // Fake user
    return {
      code: 200,
      user: {
        id: userId,
        USERNAME: `user-${userId}`,
        role: Kind.USER,
        meta: { env: 'dev', traceId: ctx?.get('traceId') },
      }
    }
  },
  async getArticle({ articleId }) {
    const ctx = getRequestContext()
    return {
      title: `Article ${articleId}`,
      content: `Hello, this is the content for article ${articleId}. (req ${ctx?.id})`
    }
  }
}

// --- Compose middleware chain & start Fastify server ---
const handler: ContextHandler = withLogging(withTrace(mainHandler))

const app = Fastify({ logger: false })

// Hook: create per-request context early (onRequest) and store via ALS
// Use run() inside onRequest to ensure full async chain retains context.
app.addHook('onRequest', (req: FastifyRequest, reply: FastifyReply, done) => {
  const ctx = createRequestContext(req)
  // enterWith keeps context for the lifetime of async chain (Fastify v5 uses async local storage internally but we maintain our own)
  requestContextStorage.enterWith(ctx)
  reply.header('X-Req-Id', ctx.id)
  done()
})

// RPC route handler (covers /rpc/Example/*) supporting common HTTP verbs
app.route({
  method: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  url: '/rpc/*',
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = getRequestContext()
    if (!ctx) return reply.code(500).send({ msg: 'missing request context' })
    const rpc = await handleExampleRpc(exampleService, req.url, req.body)
    if (rpc) {
      reply.code(rpc.status)
      for (const [k, v] of Object.entries(rpc.headers)) reply.header(k, v as any)
      return reply.send(rpc.body)
    }
    return reply.code(404).send({ msg: 'method not found' })
  }
})

// Standard application routes (explicit) using context-aware main handler
app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
  const ctx = getRequestContext(); if (!ctx) return reply.code(500).send({ msg: 'missing request context' })
  await handler(ctx, req, reply)
})
// Common health endpoint (also deprecates original ping message comment)
app.get('/health', async (req: FastifyRequest, reply: FastifyReply) => {
  const ctx = getRequestContext();
  reply.send({ ok: true, time: new Date().toISOString(), reqId: ctx?.id })
})
app.get('/json', async (req: FastifyRequest, reply: FastifyReply) => {
  const ctx = getRequestContext(); if (!ctx) return reply.code(500).send({ msg: 'missing request context' })
  await handler(ctx, req, reply)
})

// Fallback 404 handler for all unmatched routes
app.setNotFoundHandler((req, reply) => {
  reply.code(404).send({ msg: 'not found' })
})

// Global error handler – maps any thrown FastifyError to structured JSON
app.setErrorHandler(function errorHandler(err: FastifyError, req: FastifyRequest, reply: FastifyReply) {
  const ctx = getRequestContext()
  const status = (err.statusCode && err.statusCode >= 400) ? err.statusCode : 500
  console.error(`[ERR ${ctx?.id || 'unknown'}]`, err)
  reply.code(status).send({ msg: 'internal error', reqId: ctx?.id, error: err.message })
})

// Prefer explicit async startup sequence to handle errors clearly.
;(async () => {
  try {
    await app.ready()
    console.log('Fastify ready; endpoints mounted.')
    await app.listen({ port: 3000 })
    console.log('Fastify server running at http://localhost:3000/')
  } catch (err) {
    console.error('Fastify startup error', err)
    process.exit(1)
  }
})()
