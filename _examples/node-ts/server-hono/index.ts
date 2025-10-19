import { Hono } from 'hono'
import { logger } from 'hono/logger'
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

// Built-in concise request logger (method/path/status/duration)
app.use('*', logger())

// Tracing + request id enrichment middleware
app.use('*', async (c: HonoContext, next: () => Promise<void>) => {
  const traceId = randomUUID()
  c.set('traceId', traceId)
  await next()
  c.res.headers.set('X-Trace-Id', traceId)
})

// Root route
app.get('/', (c: HonoContext) => c.text(`Hello world (req ${c.get('reqId')})`))

// Health route
app.get('/health', (c: HonoContext) => c.json({ ok: true, time: new Date().toISOString(), traceId: c.get('traceId'), reqId: c.get('reqId') }))

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
