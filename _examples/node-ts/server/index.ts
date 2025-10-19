import Fastify from 'fastify'
import cors from '@fastify/cors'
import * as proto from './server.gen'
import { handleExampleRpc, WebrpcHeader } from './server.gen'

// Create fastify instance
const app = Fastify({ logger: true })

// Implement webrpc service methods
const exampleService: proto.ExampleServer = {
  ping: async () => ({}),
  getUser: async () => ({
    code: 1,
    user: {
      id: 1,
      USERNAME: 'webrpcfan',
      role: proto.Kind.ADMIN,
      meta: {},
    },
  }),
  getArticle: async (req) => ({
    title: 'Example Article #' + req.articleId,
    content: 'This is an example article fetched from the server.',
  }),
}

// Minimal Fastify route using generic resolver.
app.post('/rpc/*', async (request, reply) => {
  const out = await handleExampleRpc(exampleService, request.url, request.body)
  if (!out) return reply.callNotFound()
  for (const [k, v] of Object.entries(out.headers)) reply.header(k, v as any)
  reply.status(out.status).send(out.body)
})

// NOTE, if you are using express for some reason (dont, fastify is better),
// your handler would look something like this:
// app.post(/^\/rpc\//, async (req, res) => {
//   const out = await handleExampleRPC(exampleService, req.url, req.body)
//   if (!out) return res.status(404).end()
//   res.status(out.status)
//   for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v)
//   res.json(out.body)
// })

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
