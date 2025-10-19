import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import type { Context as HonoContext } from 'hono'
import { Kind, ExampleServer, handleExampleRpc } from "./server.gen"
import { randomUUID } from 'node:crypto'

// We now use Hono's native Context as the RPC context directly (no custom wrapper).

// ---------------------------------------------------------------------------
// Middleware signature with context (pure, explicit)
// ---------------------------------------------------------------------------
// Hono app setup
const app = new Hono()

// Middleware: enrich Hono Context with request metadata & tracing.
app.use('*', async (c: HonoContext, next: () => Promise<void>) => {
  const reqId = randomUUID()
  const start = Date.now()
  const path = c.req.path + (c.req.query() ? '?' + new URLSearchParams(c.req.query()).toString() : '')
  c.set('reqId', reqId)
  c.set('start', start)
  c.set('path', path)
  c.set('method', c.req.method.toUpperCase())
  c.set('traceId', reqId)
  console.log(`[REQ ${reqId}] ${c.req.method.toUpperCase()} ${path}`)
  try {
    await next()
  } finally {
    const duration = Date.now() - start
    console.log(`[RES ${reqId}] ${c.req.method.toUpperCase()} ${path} (${duration}ms)`)    
    c.res.headers.set('X-Trace-Id', reqId)
  }
})

// Health route
app.get('/health', (c: HonoContext) => c.json({ ok: true, time: new Date().toISOString(), reqId: c.get('reqId') }))

// Simple JSON route
app.get('/json', (c: HonoContext) => c.json({ ok: true, id: c.get('reqId'), traceId: c.get('traceId') }))

// Root route
app.get('/', (c: HonoContext) => c.text(`Hello world (req ${c.get('reqId')})`))

// RPC mount (raw handler using generated helper)
app.all('/rpc/*', async (c: HonoContext) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await handleExampleRpc(exampleService, c.req.path, body, c as HonoContext)
  if (result == null) return c.notFound()
  for (const [k, v] of Object.entries(result.headers)) c.res.headers.set(k, String(v))
  c.status(result.status as any)
  return c.json(result.body)
})

// ---------------------------------------------------------------------------
// ExampleServer implementation (in-memory demo)
// ---------------------------------------------------------------------------
const exampleService: ExampleServer<HonoContext> = {
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
      content: `Hello, this is the content for article ${articleId}. (req ${ctx.get('reqId')})`
    }
  }
}

// Start server
serve({ fetch: app.fetch, port: 3000 }, (info: { port: number }) => {
  console.log(`Hono server running at http://localhost:${info.port}`)
})
