import { describe, it, expect } from 'vitest'
import { JsonEncode, JsonDecode } from './client.gen.js'
import type { BigIntArrayTest } from './client.gen.js'


describe('JsonEncode', () => {
  it('should encode BigInt arrays and nested objects', () => {
    const input: BigIntArrayTest = {
      ids: [1n, 2n, 3n],
      timestamps: [-100n, 0n, 100n],
      messages: [
        { id: 10n, userId: 20n, timestamp: 30n, content: 'test' },
      ],
    }

    const encoded = JsonEncode(input)
    const parsed = JSON.parse(encoded)
    
    // All BigInt values (arrays and nested objects) encoded as strings
    expect(parsed).toMatchInlineSnapshot(`
      {
        "ids": [
          "1",
          "2",
          "3",
        ],
        "messages": [
          {
            "content": "test",
            "id": "10",
            "timestamp": "30",
            "userId": "20",
          },
        ],
        "timestamps": [
          "-100",
          "0",
          "100",
        ],
      }
    `)
  })

  it('should encode large BigInt values exceeding MAX_SAFE_INTEGER', () => {
    const input: BigIntArrayTest = {
      ids: [9007199254740992n, 18446744073709551615n],
      timestamps: [],
      messages: [],
    }

    const encoded = JsonEncode(input)
    const parsed = JSON.parse(encoded)
    
    expect(parsed).toMatchInlineSnapshot(`
      {
        "ids": [
          "9007199254740992",
          "18446744073709551615",
        ],
        "messages": [],
        "timestamps": [],
      }
    `)
  })
})

describe('JsonDecode', () => {
  it('should decode BigInt arrays and nested objects', () => {
    const json = JSON.stringify({
      ids: ['1', '2', '3'],
      timestamps: ['-100', '0', '100'],
      messages: [
        { id: '10', userId: '20', timestamp: '30', content: 'test' },
      ],
    })

    const decoded = JsonDecode<BigIntArrayTest>(json, 'BigIntArrayTest')

    // Strings converted to BigInt (arrays and nested objects)
    expect(decoded).toMatchInlineSnapshot(`
      {
        "ids": [
          1n,
          2n,
          3n,
        ],
        "messages": [
          {
            "content": "test",
            "id": 10n,
            "timestamp": 30n,
            "userId": 20n,
          },
        ],
        "timestamps": [
          -100n,
          0n,
          100n,
        ],
      }
    `)
    expect(typeof decoded.ids[0]).toBe('bigint')
    expect(typeof decoded.messages[0].id).toBe('bigint')
  })

  it('should decode large BigInt values', () => {
    const json = JSON.stringify({
      ids: ['9007199254740992', '18446744073709551615'],
      timestamps: [],
      messages: [],
    })

    const decoded = JsonDecode<BigIntArrayTest>(json, 'BigIntArrayTest')

    expect(decoded.ids).toEqual([9007199254740992n, 18446744073709551615n])
    expect(typeof decoded.ids[0]).toBe('bigint')
  })
})

describe('Round-trip', () => {
  it('should preserve all BigInt values through encode/decode cycle', () => {
    const original: BigIntArrayTest = {
      ids: [1n, 9007199254740992n],
      timestamps: [-100n, 0n, 100n],
      messages: [
        { id: 10n, userId: 20n, timestamp: 30n, content: 'test' },
      ],
    }

    const encoded = JsonEncode(original)
    const decoded = JsonDecode<BigIntArrayTest>(encoded, 'BigIntArrayTest')

    expect(decoded).toEqual(original)
    
  })

  it('should not mutate the original object during encoding or decoding', () => {
    const original: BigIntArrayTest = {
      ids: [1n, 2n, 3n],
      timestamps: [-100n, 0n, 100n],
      messages: [
        { id: 10n, userId: 20n, timestamp: 30n, content: 'test' },
      ],
    }

    // Create a deep clone to compare against later
    const originalClone = structuredClone(original)

    // Encode and decode
    const encoded = JsonEncode(original)
    const decoded = JsonDecode<BigIntArrayTest>(encoded, 'BigIntArrayTest')

    // Original should be completely unchanged
    expect(original).toEqual(originalClone)
    expect(original.ids).toEqual(originalClone.ids)
    expect(original.messages).toEqual(originalClone.messages)
    
    // But decoded should be a different reference
    expect(decoded).not.toBe(original)
    expect(decoded.ids).not.toBe(original.ids)
  })
})
