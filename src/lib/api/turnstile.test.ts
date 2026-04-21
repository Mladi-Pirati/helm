import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { verifyTurnstileToken } from "./turnstile";

const originalFetch = globalThis.fetch;
const originalTurnstileSecretKey = process.env.LEGALIZIRAJMO_TURNSTILE_SECRET_KEY;
const originalTurnstileExpectedHostname =
  process.env.LEGALIZIRAJMO_TURNSTILE_EXPECTED_HOSTNAME;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

function createJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

describe("verifyTurnstileToken", () => {
  beforeEach(() => {
    process.env.LEGALIZIRAJMO_TURNSTILE_SECRET_KEY = "test-turnstile-secret";
    process.env.LEGALIZIRAJMO_TURNSTILE_EXPECTED_HOSTNAME = "localhost";
    console.info = (() => {}) as typeof console.info;
    console.warn = (() => {}) as typeof console.warn;
    console.error = (() => {}) as typeof console.error;
  });

  afterEach(() => {
    if (originalTurnstileSecretKey === undefined) {
      delete process.env.LEGALIZIRAJMO_TURNSTILE_SECRET_KEY;
    } else {
      process.env.LEGALIZIRAJMO_TURNSTILE_SECRET_KEY = originalTurnstileSecretKey;
    }

    if (originalTurnstileExpectedHostname === undefined) {
      delete process.env.LEGALIZIRAJMO_TURNSTILE_EXPECTED_HOSTNAME;
    } else {
      process.env.LEGALIZIRAJMO_TURNSTILE_EXPECTED_HOSTNAME =
        originalTurnstileExpectedHostname;
    }

    globalThis.fetch = originalFetch;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  test("forms the siteverify request correctly and accepts a matching hostname", async () => {
    let fetchUrl: string | null = null;
    let fetchInit: RequestInit | undefined;

    globalThis.fetch = (async (input, init) => {
      fetchUrl = getRequestUrl(input);
      fetchInit = init;

      return createJsonResponse({
        success: true,
        hostname: "localhost",
      });
    }) as typeof fetch;

    const result = await verifyTurnstileToken("captcha-token", {
      remoteIp: "203.0.113.10",
    });

    expect(result).toEqual({
      ok: true,
      hostname: "localhost",
    });
    expect(fetchUrl).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(fetchInit?.method).toBe("POST");
    expect(fetchInit?.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(fetchInit?.cache).toBe("no-store");

    const body = new URLSearchParams(String(fetchInit?.body));

    expect(body.get("secret")).toBe("test-turnstile-secret");
    expect(body.get("response")).toBe("captcha-token");
    expect(body.get("remoteip")).toBe("203.0.113.10");
  });

  test("returns unavailable when the Turnstile secret is missing", async () => {
    delete process.env.LEGALIZIRAJMO_TURNSTILE_SECRET_KEY;
    let fetchCalled = false;

    globalThis.fetch = (async () => {
      fetchCalled = true;

      return createJsonResponse({
        success: true,
        hostname: "localhost",
      });
    }) as typeof fetch;

    const result = await verifyTurnstileToken("captcha-token");

    expect(result).toEqual({
      ok: false,
      reason: "unavailable",
      cause: "missing_secret",
      errorCodes: [],
      hostname: null,
      status: null,
    });
    expect(fetchCalled).toBe(false);
  });

  test("returns captcha invalid for an expired or duplicate token", async () => {
    globalThis.fetch = (async () =>
      createJsonResponse({
        success: false,
        hostname: "localhost",
        "error-codes": ["timeout-or-duplicate"],
      })) as typeof fetch;

    const result = await verifyTurnstileToken("expired-token");

    expect(result).toEqual({
      ok: false,
      reason: "invalid",
      errorCodes: ["timeout-or-duplicate"],
      hostname: "localhost",
    });
  });

  test("returns unavailable for an invalid configured secret", async () => {
    globalThis.fetch = (async () =>
      createJsonResponse({
        success: false,
        hostname: "localhost",
        "error-codes": ["invalid-input-secret"],
      })) as typeof fetch;

    const result = await verifyTurnstileToken("captcha-token");

    expect(result).toEqual({
      ok: false,
      reason: "unavailable",
      cause: "invalid_secret",
      errorCodes: ["invalid-input-secret"],
      hostname: "localhost",
      status: 200,
    });
  });

  test("returns captcha invalid on hostname mismatch", async () => {
    process.env.LEGALIZIRAJMO_TURNSTILE_EXPECTED_HOSTNAME = "legalizirajmo.si";

    globalThis.fetch = (async () =>
      createJsonResponse({
        success: true,
        hostname: "localhost",
      })) as typeof fetch;

    const result = await verifyTurnstileToken("captcha-token");

    expect(result).toEqual({
      ok: false,
      reason: "invalid",
      errorCodes: [],
      hostname: "localhost",
    });
  });

  test("treats malformed siteverify JSON as unavailable instead of throwing", async () => {
    globalThis.fetch = (async () =>
      createJsonResponse({
        hostname: "localhost",
      })) as typeof fetch;

    const result = await verifyTurnstileToken("captcha-token");

    expect(result).toEqual({
      ok: false,
      reason: "unavailable",
      cause: "invalid_response_body",
      errorCodes: [],
      hostname: null,
      status: 200,
    });
  });
});
