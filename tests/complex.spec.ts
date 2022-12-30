import { describe, expect, it } from "vitest";
import { TestApi } from "./client";

describe("Test complex rpc client communication", () => {
  it("It should get the complex data and send it back with no error", async () => {
    const testApiClient = new TestApi(
      `http://localhost:${process.env.PORT}`,
      fetch
    );

    const complex = await testApiClient.getComplex();
    await expect(
      testApiClient.sendComplex(complex, {})
    ).resolves.not.toThrowError();
  });
});
