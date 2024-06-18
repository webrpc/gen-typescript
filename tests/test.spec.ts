import { describe, expect, it } from "vitest";
import {
  AccessDeniedError,
  ConfirmAccountError,
  DatabaseDownError,
  DeactivatedError,
  ElasticDownError,
  ExpiredTokenError,
  FileInfectedError,
  FileTooBigError,
  FileTypeError,
  InvalidTokenError,
  InvalidUsernameError,
  MissingArgumentError,
  NotImplementedError,
  RateLimitedError,
  TestApi,
  UnauthorizedError,
  UnexpectedValueError,
  UserBusyError,
  UserNotFoundError,
  WebrpcEndpointError,
  WebrpcError,
} from "./client";

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

  it("getKinds() should receive a list kinds successfully", async () => {
    await expect(testApiClient.getKinds()).resolves.not.toThrowError();
  });

  it("GetKindCount() should receive a count of kinds successfully", async () => {
    await expect(testApiClient.getKindCount()).resolves.not.toThrowError();
  });
});

describe("Test custom webrpc schema errors", () => {
  const tt = [
    {
      code: 0,
      name: "WebrpcEndpoint",
      msg: "endpoint error",
      errClass: WebrpcEndpointError,
      httpStatusCode: 400,
      cause: "failed to read file: unexpected EOF",
    },
    {
      code: 1,
      name: "Unauthorized",
      msg: "unauthorized",
      errClass: UnauthorizedError,
      httpStatusCode: 401,
      cause: "failed to verify JWT token",
    },
    {
      code: 2,
      name: "ExpiredToken",
      msg: "expired token",
      errClass: ExpiredTokenError,
      httpStatusCode: 401,
    },
    {
      code: 3,
      name: "InvalidToken",
      msg: "invalid token",
      errClass: InvalidTokenError,
      httpStatusCode: 401,
    },
    {
      code: 4,
      name: "Deactivated",
      msg: "account deactivated",
      errClass: DeactivatedError,
      httpStatusCode: 403,
    },
    {
      code: 5,
      name: "ConfirmAccount",
      msg: "confirm your email",
      errClass: ConfirmAccountError,
      httpStatusCode: 403,
    },
    {
      code: 6,
      name: "AccessDenied",
      msg: "access denied",
      errClass: AccessDeniedError,
      httpStatusCode: 403,
    },
    {
      code: 7,
      name: "MissingArgument",
      msg: "missing argument",
      errClass: MissingArgumentError,
      httpStatusCode: 400,
    },
    {
      code: 8,
      name: "UnexpectedValue",
      msg: "unexpected value",
      errClass: UnexpectedValueError,
      httpStatusCode: 400,
    },
    {
      code: 100,
      name: "RateLimited",
      msg: "too many requests",
      errClass: RateLimitedError,
      httpStatusCode: 429,
      cause: "1000 req/min exceeded",
    },
    {
      code: 101,
      name: "DatabaseDown",
      msg: "service outage",
      errClass: DatabaseDownError,
      httpStatusCode: 503,
    },
    {
      code: 102,
      name: "ElasticDown",
      msg: "search is degraded",
      errClass: ElasticDownError,
      httpStatusCode: 503,
    },
    {
      code: 103,
      name: "NotImplemented",
      msg: "not implemented",
      errClass: NotImplementedError,
      httpStatusCode: 501,
    },
    {
      code: 200,
      name: "UserNotFound",
      msg: "user not found",
      errClass: UserNotFoundError,
      httpStatusCode: 400,
    },
    {
      code: 201,
      name: "UserBusy",
      msg: "user busy",
      errClass: UserBusyError,
      httpStatusCode: 400,
    },
    {
      code: 202,
      name: "InvalidUsername",
      msg: "invalid username",
      errClass: InvalidUsernameError,
      httpStatusCode: 400,
    },
    {
      code: 300,
      name: "FileTooBig",
      msg: "file is too big (max 1GB)",
      errClass: FileTooBigError,
      httpStatusCode: 400,
    },
    {
      code: 301,
      name: "FileInfected",
      msg: "file is infected",
      errClass: FileInfectedError,
      httpStatusCode: 400,
    },
    {
      code: 302,
      name: "FileType",
      msg: "unsupported file type",
      errClass: FileTypeError,
      httpStatusCode: 400,
      cause: ".wav is not supported",
    },
  ];

  tt.forEach((tc) => {
    it(`getSchemaError({code: ${tc.code}}) should throw ${tc.name}Error`, async () => {
      try {
        const resp = await testApiClient.getSchemaError({ code: tc.code });
        expect(resp, "expected to throw error").toBeUndefined();
      } catch (e) {
        // console.error(e);

        expect(e).instanceOf(tc.errClass);
        expect(e).instanceOf(WebrpcError);

        if (e instanceof WebrpcError) {
          expect(e.message).toBe(tc.msg);
          expect(e.code).toBe(tc.code);
          expect(e.name).toBe(tc.name);
          expect(e.cause).toBe(tc.cause);
        }
      }
    });
  });
});
