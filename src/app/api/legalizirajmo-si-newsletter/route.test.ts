import { beforeEach, describe, expect, mock, test } from "bun:test";

type RateLimitResult = {
  rateLimited: boolean;
  retryAfterSeconds: number | null;
};

type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "unavailable" };

let rateLimitResult: RateLimitResult = {
  rateLimited: false,
  retryAfterSeconds: null,
};
let turnstileResult: TurnstileResult = { ok: true };
let insertError: unknown = null;
let insertedValues: Array<Record<string, unknown>> = [];
let turnstileCalls: Array<{ token: string; remoteIp: string | null }> = [];

const newsletterTable = Symbol("legalizirajmoSiNewsletterSubscriptions");

async function checkRateLimit() {
  return rateLimitResult;
}

async function verifyTurnstileToken(
  token: string,
  options: { remoteIp?: string | null } = {},
) {
  turnstileCalls.push({
    token,
    remoteIp: options.remoteIp ?? null,
  });

  return turnstileResult;
}

const db = {
  insert(table: unknown) {
    expect(table).toBe(newsletterTable);

    return {
      async values(values: Record<string, unknown>) {
        insertedValues.push(values);

        if (insertError) {
          throw insertError;
        }
      },
    };
  },
};

mock.module("@/db", () => ({ db }));
mock.module("@/db/schema", () => ({
  legalizirajmoSiNewsletterSubscriptions: newsletterTable,
}));
mock.module("@/lib/api/rate-limit", () => ({ checkRateLimit }));
mock.module("@/lib/api/turnstile", () => ({ verifyTurnstileToken }));

const routeModulePromise = import("./route");

function createRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request("https://example.com/api/legalizirajmo-si-newsletter", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  rateLimitResult = {
    rateLimited: false,
    retryAfterSeconds: null,
  };
  turnstileResult = { ok: true };
  insertError = null;
  insertedValues = [];
  turnstileCalls = [];
});

describe("POST /api/legalizirajmo-si-newsletter", () => {
  test("returns 204 for a normal valid signup without captcha", async () => {
    const { POST } = await routeModulePromise;
    const response = await POST(
      createRequest({ email: "newsletter@example.com" }),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(insertedValues).toEqual([
      {
        email: "newsletter@example.com",
        rawPayload: {
          email: "newsletter@example.com",
        },
      },
    ]);
    expect(turnstileCalls).toHaveLength(0);
  });

  test("returns 429 captcha_required when the normal rate limit is exceeded", async () => {
    const { POST } = await routeModulePromise;

    rateLimitResult = {
      rateLimited: true,
      retryAfterSeconds: 17,
    };

    const response = await POST(
      createRequest({ email: "newsletter@example.com" }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");

    const body = (await response.json()) as {
      code: string;
      message: string;
    };

    expect(body.code).toBe("captcha_required");
    expect(body.message.length).toBeGreaterThan(0);
    expect(insertedValues).toHaveLength(0);
  });

  test("allows a challenged retry with a valid captcha to bypass the normal rate limit", async () => {
    const { POST } = await routeModulePromise;

    rateLimitResult = {
      rateLimited: true,
      retryAfterSeconds: 17,
    };

    const response = await POST(
      createRequest(
        {
          email: "newsletter@example.com",
          captchaToken: "token-from-turnstile",
        },
        {
          "x-forwarded-for": "203.0.113.10, 70.41.3.18",
        },
      ),
    );

    expect(response.status).toBe(204);
    expect(turnstileCalls).toEqual([
      {
        token: "token-from-turnstile",
        remoteIp: "203.0.113.10",
      },
    ]);
    expect(insertedValues).toEqual([
      {
        email: "newsletter@example.com",
        rawPayload: {
          email: "newsletter@example.com",
        },
      },
    ]);
  });

  test("returns 400 captcha_invalid when captcha verification fails", async () => {
    const { POST } = await routeModulePromise;

    rateLimitResult = {
      rateLimited: true,
      retryAfterSeconds: 17,
    };
    turnstileResult = {
      ok: false,
      reason: "invalid",
    };

    const response = await POST(
      createRequest({
        email: "newsletter@example.com",
        captchaToken: "expired-token",
      }),
    );

    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      code: string;
      message: string;
    };

    expect(body.code).toBe("captcha_invalid");
    expect(body.message.length).toBeGreaterThan(0);
    expect(insertedValues).toHaveLength(0);
  });

  test("preserves the duplicate-email 409 response", async () => {
    const { POST } = await routeModulePromise;

    insertError = {
      code: "23505",
    };

    const response = await POST(
      createRequest({ email: "newsletter@example.com" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "That email address is already subscribed.",
      fieldErrors: {
        email: ["That email address is already subscribed."],
      },
    });
  });

  test("preserves the existing invalid-email validation response", async () => {
    const { POST } = await routeModulePromise;
    const response = await POST(createRequest({ email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Validation failed.",
      fieldErrors: {
        email: ["A valid email address is required."],
      },
    });
    expect(insertedValues).toHaveLength(0);
    expect(turnstileCalls).toHaveLength(0);
  });
});
