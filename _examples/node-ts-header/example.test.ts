import http from 'node:http'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ExampleService, UnauthorizedError } from './example.gen.js'
import { startServer } from './server.js'

let server: http.Server
let client: ExampleService

const PORT = 4244

beforeAll(async () => {
  server = await startServer(PORT)
  const fetch_ = (input: RequestInfo, init?: RequestInit) => fetch(input, init)
  client = new ExampleService(`http://localhost:${PORT}`, fetch_)
})

afterAll(() => {
  server?.close()
})

describe('Header example', () => {
  it('Ping - no headers', async () => {
    await expect(client.ping()).resolves.not.toThrow()
  })

  it('GetUser - authToken as header, userID in body', async () => {
    const resp = await client.getUser({ authToken: 'my-secret-token', userID: 42 })
    expect(resp.user.id).toBe(42)
    expect(resp.user.username).toBe('alice')
  })

  it('GetUser - missing token returns Unauthorized', async () => {
    await expect(client.getUser({ authToken: '', userID: 42 })).rejects.toThrow()
  })

  it('CreateUser - multiple headers (authToken, role), username in body', async () => {
    const resp = await client.createUser({ authToken: 'my-secret-token', role: 'admin', username: 'bob' })
    expect(resp.user.username).toBe('bob')
  })

  it('DeleteUser - all params as headers, no body', async () => {
    await expect(client.deleteUser({ authToken: 'my-secret-token', userID: 99 })).resolves.not.toThrow()
  })

  it('DeleteUser - missing token returns Unauthorized', async () => {
    await expect(client.deleteUser({ authToken: '', userID: 99 })).rejects.toThrow()
  })
})
