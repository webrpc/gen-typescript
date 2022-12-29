import {describe, expect, it} from 'vitest';
import {ComplexApi} from "./client";

describe('Test complex rpc client communication', () => {
  it('It should get the complex data and send it back with no error', async () => {
    const complexApiClient = new ComplexApi(`http://localhost:${process.env.PORT}`, fetch)
    const complexData = await complexApiClient.getComplex()

    await expect(complexApiClient.sendComplex(complexData, {})).resolves.not.toThrowError()
  })
});
