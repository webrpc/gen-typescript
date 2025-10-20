import { HttpHandler } from './helpers'
import { randomUUID } from 'node:crypto'

// Middleware for logging requests & responses
export const withLogging = (next: HttpHandler): HttpHandler => {
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

// Middleware for adding a trace id header
export const withTrace = (next: HttpHandler): HttpHandler => {
  return async (ctx, req, res) => {
    ctx.set('traceId', randomUUID())
    res.setHeader('X-Trace-Id', ctx.reqId)
    await next(ctx, req, res)
  }
}
