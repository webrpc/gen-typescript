import http, { IncomingMessage, ServerResponse } from 'node:http'
import { HttpHandler, createWebrpcServerHandler, RequestContext, createRequestContext, composeHttpHandler, sendJson } from './helpers'
import { Kind, ExampleServer, serveExampleRpc } from './server.gen'
import { withLogging, withTrace } from './middleware'

// ExampleServer RPC implementation of the webrpc service definition
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

// Main routes entrypoint of the service
const routes = (): HttpHandler  => {
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
        res.end(`Hello world (req ${ctx.reqId})\n`)
        return
      }
      case "/json": {
        sendJson(res, 200, { ok: true, time: new Date().toISOString(), reqId: ctx.reqId })
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

// Compose middleware chain and primary routes entrypoint handler
const handler = composeHttpHandler([withLogging, withTrace], routes())

// Node http server bootstrap
http.createServer(async (req, res) => {
  const ctx = createRequestContext()

  const abort = () => {
    const controller: AbortController | undefined = (ctx as any)._controller
    if (controller && !controller.signal.aborted) controller.abort()
  }
  req.once('aborted', abort)
  res.once('close', abort)

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
