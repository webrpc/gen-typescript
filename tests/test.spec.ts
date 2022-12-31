import { describe, expect, it } from "vitest";
import { TestApi } from "./client";

describe("Test interoperability with webrpc-test reference server", () => {
  const testApiClient = new TestApi(
    `http://localhost:${process.env.PORT}`,
    fetch
  );

  it("getEmpty() should get empty type successfully", async () => {
    await expect(testApiClient.getEmpty()).resolves.not.toThrowError();
  });

  it("getError() should throw error", async () => {
    await expect(() => testApiClient.getError()).rejects.toThrowError();
  });

  it("getOne() should receive simple type and send it back via sendOne() successfully", async () => {
    const complex = await testApiClient.getOne();
    await expect(
      testApiClient.sendOne(complex, {})
    ).resolves.not.toThrowError();
  });

  it("getMulti() should receive simple type and send it back via sendMulti() successfully", async () => {
    const { one, two, three } = await testApiClient.getMulti();
    await expect(
      testApiClient.sendMulti({ one, two, three }, {})
    ).resolves.not.toThrowError();
  });

  it("getComplex() should receive complex type and send it back via sendComplex() successfully", async () => {
    const complex = await testApiClient.getComplex();
    await expect(
      testApiClient.sendComplex(complex, {})
    ).resolves.not.toThrowError();
  });
});
