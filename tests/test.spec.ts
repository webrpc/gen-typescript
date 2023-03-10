import { describe, expect, it } from "vitest";
import { TestApi, WebrpcError } from "./client";

const testApiClient = new TestApi(
  `http://localhost:${process.env.PORT}`,
  fetch
);

describe("Test interoperability with webrpc-test reference server", () => {
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

describe("Test custom webrpc schema errors", () => {
  const tt = [
    {
      code: 0,
      name: "WebrpcServerError",
      msg: "server error",
      httpStatusCode: 400,
    },
    {
      code: 1,
      name: "Unauthorized",
      msg: "unauthorized",
      httpStatusCode: 401,
    },
    {
      code: 2,
      name: "ExpiredToken",
      msg: "expired token",
      httpStatusCode: 401,
    },
    {
      code: 3,
      name: "InvalidToken",
      msg: "invalid token",
      httpStatusCode: 401,
    },
    {
      code: 4,
      name: "Deactivated",
      msg: "account deactivated",
      httpStatusCode: 403,
    },
    {
      code: 5,
      name: "ConfirmAccount",
      msg: "confirm your email",
      httpStatusCode: 403,
    },
    {
      code: 6,
      name: "AccessDenied",
      msg: "access denied",
      httpStatusCode: 403,
    },
    {
      code: 7,
      name: "MissingArgument",
      msg: "missing argument",
      httpStatusCode: 400,
    },
    {
      code: 8,
      name: "UnexpectedValue",
      msg: "unexpected value",
      httpStatusCode: 400,
    },
    {
      code: 100,
      name: "RateLimited",
      msg: "too many requests",
      httpStatusCode: 429,
    },
    {
      code: 101,
      name: "DatabaseDown",
      msg: "service outage",
      httpStatusCode: 503,
    },
    {
      code: 102,
      name: "ElasticDown",
      msg: "search is degraded",
      httpStatusCode: 503,
    },
    {
      code: 103,
      name: "NotImplemented",
      msg: "not implemented",
      httpStatusCode: 501,
    },
    {
      code: 200,
      name: "UserNotFound",
      msg: "user not found",
      httpStatusCode: 400,
    },
    { code: 201, name: "UserBusy", msg: "user busy", httpStatusCode: 400 },
    {
      code: 202,
      name: "InvalidUsername",
      msg: "invalid username",
      httpStatusCode: 400,
    },
    {
      code: 300,
      name: "FileTooBig",
      msg: "file is too big (max 1GB)",
      httpStatusCode: 400,
    },
    {
      code: 301,
      name: "FileInfected",
      msg: "file is infected",
      httpStatusCode: 400,
    },
    {
      code: 302,
      name: "FileType",
      msg: "unsupported file type",
      httpStatusCode: 400,
    },
  ];

  tt.forEach((tc) => {
    it(`getSchemaError({code: ${tc.code}}) should throw WebrpcError ${tc.code} ${tc.name}`, async () => {
      try {
        const resp = await testApiClient.getSchemaError({ code: tc.code });
        expect(resp, "expected to throw error").toBeUndefined();
      } catch (e) {
        console.log(e);

        expect(e).instanceOf(WebrpcError);

        if (e instanceof WebrpcError) {
          expect(e.message).toBe(tc.msg);
          expect(e.code).toBe(tc.code);
          expect(e.name).toBe(tc.name);
          //expect(e.status).toBe(tc.httpStatusCode);
        }
      }
    });
  });
});
