import Fastify from 'fastify'
import type { FastifyRequest, FastifyReply, FastifyError, FastifyPluginCallback } from 'fastify'
import cors from '@fastify/cors'
import { Kind, ExampleServer, serveExampleRpc } from './server.gen'
import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Request Context Implementation
// ---------------------------------------------------------------------------
// This mimics the pattern commonly used in Go, Express, Fastify, etc.

export interface RequestContext {
  start: number
  traceId: string
  bag: Map<string, unknown>
  set<T = unknown>(key: string, value: T): void
  get<T = unknown>(key: string): T | undefined

  // Reference to underlying FastifyRequest for access in RPC/service layer
  req: FastifyRequest
}

declare module 'fastify' {
  interface FastifyRequest {
    ctx: RequestContext
  }
}

const buildRequestContext = (req: FastifyRequest): RequestContext => {
  const ctx: RequestContext = {
    traceId: randomUUID(),
    start: Date.now(),
    bag: new Map<string, unknown>(),
    set(key, value) { this.bag.set(key, value) },
    get(key) { return this.bag.get(key) as any },
    req,
  }

  // Redefine req as non-enumerable to avoid accidental JSON stringification loops
  Object.defineProperty(ctx, 'req', { value: req, enumerable: false, writable: false })
  return ctx
}

// ---------------------------------------------------------------------------
// --- Main handler (uses request.ctx directly) ---
const mainHandler = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const ctx = req.ctx
  switch (req.url) {
    case '/':
      reply.type('text/plain').send(`Hello world (req ${ctx.traceId})\n`)
      return
    case '/json':
      reply.send({ ok: true, time: new Date().toISOString(), traceId: ctx.traceId })
      return
    default:
      reply.code(404).type('text/plain').send('Not Found\n')
  }
}

// ---------------------------------------------------------------------------
// ExampleServer implementation (in-memory demo)
// ---------------------------------------------------------------------------
const exampleService: ExampleServer<RequestContext> = {
  async ping(ctx) {
    console.log('ping from request', ctx.req.url)
    return {}
  },
  async getUser(ctx, { userId }) {
    return {
      code: 200,
      user: {
        id: userId,
        USERNAME: `user-${userId}`,
        role: Kind.USER,
        meta: { env: 'dev', traceId: ctx.traceId },
      }
    }
  },
  async getArticle(ctx, { articleId }) {
    return {
      title: `Article ${articleId}`,
      content: `Hello, this is the content for article ${articleId}. (req ${ctx.traceId})`
    }
  }
}

// Fastify instance with built-in logger enabled
const app = Fastify({ logger: { level: 'info' } })

// Hook: create per-request context early (onRequest) and store via ALS
// Use run() inside onRequest to ensure full async chain retains context.
app.decorateRequest('ctx', null as any)
app.addHook('onRequest', (req, reply, done) => {
  req.ctx = buildRequestContext(req)
  reply.header('X-Trace-Id', req.ctx.traceId)
  done()
})

// Custom trace plugin example (just ensures a trace header is surfaced)
// const tracePlugin: FastifyPluginCallback = (instance, _opts, done) => {
//   instance.addHook('preHandler', (req, reply, next) => {
//     reply.header('X-Trace-Id', req.ctx.traceId)
//     next()
//   })
//   done()
// }
// app.register(tracePlugin)

// RPC route handler (covers /rpc/Example/*) supporting common HTTP verbs
app.route({
  method: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  url: '/rpc/*',
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const rpc = await serveExampleRpc(exampleService, req.ctx, req.url, req.body)
    if (rpc) {
      reply.code(rpc.status)
      for (const [k, v] of Object.entries(rpc.headers)) reply.header(k, v as any)
      return reply.send(rpc.body)
    }
    return reply.code(404).send({ msg: 'method not found' })
  }
})

// Standard application routes (explicit) using context-aware main handler
app.get('/', async (req, reply) => { await mainHandler(req, reply) })

// Common health endpoint (also deprecates original ping message comment)
app.get('/health', async (req: FastifyRequest, reply: FastifyReply) => {
  reply.send({ ok: true, time: new Date().toISOString(), reqId: req.ctx.traceId })
})

app.get('/json', async (req, reply) => { await mainHandler(req, reply) })

// Fallback 404 handler for all unmatched routes
app.setNotFoundHandler((req, reply) => {
  reply.code(404).send({ msg: 'not found' })
})

// Global error handler – maps any thrown FastifyError to structured JSON
app.setErrorHandler(function errorHandler(err: FastifyError, req, reply) {
  const status = (err.statusCode && err.statusCode >= 400) ? err.statusCode : 500
  req.log.error({ err, reqId: req.ctx?.traceId }, 'request error')
  reply.code(status).send({ msg: 'internal error', reqId: req.ctx?.traceId, error: err.message })
})

// Prefer explicit async startup sequence to handle errors clearly.
;(async () => {
  try {
    await app.register(cors, {
      origin: true,
      credentials: true,
      methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
      allowedHeaders: ['Content-Type','Authorization','Webrpc'],
      exposedHeaders: ['X-Trace-Id'],
      maxAge: 86400
    })
    await app.listen({ port: 3000 })
    app.log.info('Fastify server running at http://localhost:3000/')
  } catch (err) {
    app.log.error({ err }, 'Fastify startup error')
    process.exit(1)
  }
})()
