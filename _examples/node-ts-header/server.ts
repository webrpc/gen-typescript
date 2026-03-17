import http from 'node:http'
import {
  ExampleServiceServer,
  serveExampleServiceRpc,
  UnauthorizedError,
} from './example.gen.js'

const exampleService: ExampleServiceServer<void> = {
  async ping() {
    return {}
  },

  async getUser(_ctx, { authToken, userID }) {
    if (!authToken) {
      throw UnauthorizedError.new({ cause: 'missing auth token' })
    }
    return {
      user: { id: userID, username: 'alice' },
    }
  },

  async createUser(_ctx, { authToken, username }) {
    if (!authToken) {
      throw UnauthorizedError.new({ cause: 'missing auth token' })
    }
    return {
      user: { id: 1, username },
    }
  },

  async deleteUser(_ctx, { authToken }) {
    if (!authToken) {
      throw UnauthorizedError.new({ cause: 'missing auth token' })
    }
    return {}
  },
}

const readBody = (req: http.IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk.toString('utf8') })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })

const getHeaders = (req: http.IncomingMessage): Record<string, string> => {
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers[key] = value
    }
  }
  return headers
}

export const startServer = (port: number): Promise<http.Server> => {
  const server = http.createServer(async (req, res) => {
    const url = req.url || ''

    if (req.method !== 'POST') {
      res.writeHead(405).end()
      return
    }

    const raw = await readBody(req)
    let body: any = {}
    if (raw.length > 0) {
      try {
        body = JSON.parse(raw)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ msg: 'invalid JSON' }))
        return
      }
    }

    const reqHeaders = getHeaders(req)
    const result = await serveExampleServiceRpc(exampleService, undefined, url, body, reqHeaders)
    if (!result) {
      res.writeHead(404).end()
      return
    }

    const payload = JSON.stringify(result.body ?? {})
    res.writeHead(result.status, {
      ...result.headers,
      'Content-Length': Buffer.byteLength(payload),
    })
    res.end(payload)
  })

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server))
  })
}
