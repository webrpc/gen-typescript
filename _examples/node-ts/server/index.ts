import Fastify from 'fastify'
import cors from '@fastify/cors'
import * as proto from './server.gen'
import { createExampleHttpHandler, handleExampleRPC, WebrpcHeader } from './server.gen'

// Create fastify instance
const app = Fastify({ logger: true })

// We'll register plugins inside start() to avoid top-level await.

// Implement service procedures.
const exampleService: proto.ExampleServer = {
  Ping: () => ({}),
  GetUser: () => ({
    code: 1,
    user: {
      id: 1,
      USERNAME: 'webrpcfan',
      role: proto.Kind.ADMIN,
      meta: {},
    },
  }),
  GetArticle: (req) => ({
    title: 'Example Article #' + req.articleId,
    content: 'This is an example article fetched from the server.',
  }),
}

// Minimal Fastify route using generic resolver.
app.post('/rpc/*', async (request, reply) => {
  const out = await handleExampleRPC(exampleService, request.url, request.body)
  if (!out) return reply.callNotFound()
  for (const [k, v] of Object.entries(out.headers)) reply.header(k, v as any)
  reply.status(out.status).send(out.body)
})

// Start server
const start = async () => {
	try {
		await app.register(cors, {
			origin: true,
			methods: ['POST', 'GET', 'OPTIONS'],
			allowedHeaders: ['Content-Type', WebrpcHeader],
			exposedHeaders: ['Content-Type', WebrpcHeader]
		})
		await app.listen({ port: 3000, host: '0.0.0.0' })
		console.log('> Listening on port 3000')
	} catch (err) {
		app.log.error(err)
		process.exit(1)
	}
}

start()
