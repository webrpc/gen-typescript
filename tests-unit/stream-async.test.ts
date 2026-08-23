import { describe, expect, it, vi } from 'vitest'
import {
  StreamBoomError,
  StreamTest,
  WebrpcStreamLostError,
} from './stream-async.gen.js'
import type { Fetch } from './stream-async.gen.js'

const encoder = new TextEncoder()

const streamBody = (
  chunks: string[],
  options: { close?: boolean; error?: unknown } = {},
): ReadableStream<Uint8Array> => {
  const { close = true, error } = options

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }

      if (error) {
        controller.error(error)
      } else if (close) {
        controller.close()
      }
    },
  })
}

const streamResponse = (
  chunks: string[],
  options: { close?: boolean; error?: unknown; status?: number } = {},
): Response => {
  return new Response(streamBody(chunks, options), {
    status: options.status ?? 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}

const collect = async <T>(iterable: AsyncIterable<T>): Promise<T[]> => {
  const values: T[] = []
  for await (const value of iterable) {
    values.push(value)
  }
  return values
}

describe('async iterable stream client', () => {
  it('streams every decoded line from a generated stream method', async () => {
    const first = JSON.stringify({ message: { id: 1, text: 'hello' } }) + '\n'
    const second = JSON.stringify({ message: { id: 2, text: 'world' } }) + '\n'
    const mockFetch = vi.fn((_input: RequestInfo, _init?: RequestInit) =>
      Promise.resolve(streamResponse(['\n', first.slice(0, 12), first.slice(12), second])),
    )
    const api = new StreamTest('https://api.test/', mockFetch as Fetch)

    const messages = await collect(
      api.streamMessages(
        { roomId: 'room-1' },
        { headers: { 'X-Test': 'yes' } },
      ),
    )

    expect(messages).toEqual([
      { message: { id: 1, text: 'hello' } },
      { message: { id: 2, text: 'world' } },
    ])
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const [url, init] = mockFetch.mock.calls[0]!
    expect(url).toBe('https://api.test/rpc/StreamTest/StreamMessages')
    expect(JSON.parse(String(init?.body))).toEqual({ roomId: 'room-1' })
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Test': 'yes',
    })
  })

  it('supports stream methods without request inputs', async () => {
    const mockFetch = vi.fn((_input: RequestInfo, _init?: RequestInit) =>
      Promise.resolve(
        streamResponse([
          JSON.stringify({ tick: 1 }) + '\n',
          JSON.stringify({ tick: 2 }) + '\n',
        ]),
      ),
    )
    const api = new StreamTest('https://api.test', mockFetch as Fetch)

    await expect(collect(api.streamTicks())).resolves.toEqual([
      { tick: 1 },
      { tick: 2 },
    ])

    const [url, init] = mockFetch.mock.calls[0]!
    expect(url).toBe('https://api.test/rpc/StreamTest/StreamTicks')
    expect(init?.body).toBe('{}')
  })

  it('throws typed webrpc errors emitted inside the stream', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve(
        streamResponse([
          JSON.stringify({
            webrpcError: {
              code: 100,
              message: 'stream boom',
              status: 500,
            },
          }) + '\n',
        ]),
      ),
    )
    const api = new StreamTest('https://api.test', mockFetch as Fetch)

    await expect(collect(api.streamMessages({ roomId: 'room-1' }))).rejects.toBeInstanceOf(
      StreamBoomError,
    )
  })

  it('throws WebrpcStreamLostError when the response stream errors', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve(
        streamResponse([JSON.stringify({ tick: 1 }) + '\n'], {
          error: new Error('socket closed'),
        }),
      ),
    )
    const api = new StreamTest('https://api.test', mockFetch as Fetch)

    await expect(collect(api.streamTicks())).rejects.toBeInstanceOf(
      WebrpcStreamLostError,
    )
  })

  it('finishes cleanly when the provided AbortSignal is aborted', async () => {
    const abortController = new AbortController()
    const mockFetch = vi.fn(() =>
      Promise.resolve(
        streamResponse([JSON.stringify({ tick: 1 }) + '\n'], { close: false }),
      ),
    )
    const api = new StreamTest('https://api.test', mockFetch as Fetch)
    const ticks = []

    for await (const tick of api.streamTicks({ signal: abortController.signal })) {
      ticks.push(tick)
      abortController.abort()
    }

    expect(ticks).toEqual([{ tick: 1 }])
  })
})
