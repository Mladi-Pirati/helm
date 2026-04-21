import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

type RateLimitResult = {
  rateLimited: boolean;
  retryAfterSeconds: number | null;
};

type TurnstileResult =
  | { ok: true; hostname?: string | null }
  | {
      ok: false;
      reason: "invalid";
      errorCodes?: string[];
      hostname?: string | null;
    }
  | {
      ok: false;
      reason: "unavailable";
      cause?: string;
      errorCodes?: string[];
      hostname?: string | null;
      status?: number | null;
    };

let rateLimitResult: RateLimitResult = {
  rateLimited: false,
  retryAfterSeconds: null,
};
let turnstileResult: TurnstileResult = { ok: true };
let insertError: unknown = null;
let insertedValues: Array<Record<string, unknown>> = [];
let turnstileCalls: Array<{ token: string; remoteIp: string | null }> = [];
let createdApplication = {
  id: "application-123",
  status: "new",
};

const membershipApplicationsTable = {
  id: "id",
  status: "status",
};
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

const validMembershipApplicationPayload = {
  fullName: "Ada Lovelace",
  dateOfBirth: "1994-12-10",
  placeOfBirth: "Ljubljana",
  streetAddress: "Pirate Street 10",
  cityAndPostalCode: "1000 Ljubljana",
  residenceRegion: "Osrednjeslovenska",
  email: "ada@example.com",
  participationMode: "Aktiven član (se aktivno udejstvuješ)" as const,
  consentsToDataProcessing: true,
  acceptsStatuteAndProgram: true,
};

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
    expect(table).toBe(membershipApplicationsTable);

    return {
      values(values: Record<string, unknown>) {
        insertedValues.push(values);

        return {
          async returning(returningShape: Record<string, unknown>) {
            expect(returningShape).toEqual({
              id: "id",
              status: "status",
            });

            if (insertError) {
              throw insertError;
            }

            return [createdApplication];
          },
        };
      },
    };
  },
};

mock.module("@/db", () => ({ db }));
mock.module("@/db/schema", () => ({
  mladiPiratiMembershipApplications: membershipApplicationsTable,
}));
mock.module("@/lib/api/rate-limit", () => ({ checkRateLimit }));
mock.module("@/lib/api/turnstile", () => ({ verifyTurnstileToken }));

const routeModulePromise = import("./route");

function createRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request(
    "https://example.com/api/mladi-pirati-membership-applications",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );
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
  createdApplication = {
    id: "application-123",
    status: "new",
  };
  console.info = (() => {}) as typeof console.info;
  console.warn = (() => {}) as typeof console.warn;
  console.error = (() => {}) as typeof console.error;
});

afterEach(() => {
  console.info = originalConsoleInfo;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

describe("POST /api/mladi-pirati-membership-applications", () => {
  test("returns 201 for a normal valid membership submission without captcha", async () => {
    const { POST } = await routeModulePromise;
    const response = await POST(
      createRequest(validMembershipApplicationPayload),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "application-123",
      status: "new",
    });
    expect(insertedValues).toEqual([
      {
        ...validMembershipApplicationPayload,
        phone: null,
        discordUsername: null,
        motivation: null,
        status: "new",
        rawPayload: validMembershipApplicationPayload,
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
      createRequest(validMembershipApplicationPayload),
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
    expect(turnstileCalls).toHaveLength(0);
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
          ...validMembershipApplicationPayload,
          captchaToken: "token-from-turnstile",
        },
        {
          "x-forwarded-for": "203.0.113.10, 70.41.3.18",
        },
      ),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "application-123",
      status: "new",
    });
    expect(turnstileCalls).toEqual([
      {
        token: "token-from-turnstile",
        remoteIp: "203.0.113.10",
      },
    ]);
    expect(insertedValues).toEqual([
      {
        ...validMembershipApplicationPayload,
        phone: null,
        discordUsername: null,
        motivation: null,
        status: "new",
        rawPayload: validMembershipApplicationPayload,
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
        ...validMembershipApplicationPayload,
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

  test("returns 400 captcha_invalid when captchaToken is blank", async () => {
    const { POST } = await routeModulePromise;

    rateLimitResult = {
      rateLimited: true,
      retryAfterSeconds: 17,
    };

    const response = await POST(
      createRequest({
        ...validMembershipApplicationPayload,
        captchaToken: "   ",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "captcha_invalid",
      message: "Captcha verification failed. Please try again.",
    });
    expect(turnstileCalls).toHaveLength(0);
    expect(insertedValues).toHaveLength(0);
  });

  test("returns 500 when captcha verification is unavailable", async () => {
    const { POST } = await routeModulePromise;

    rateLimitResult = {
      rateLimited: true,
      retryAfterSeconds: 17,
    };
    turnstileResult = {
      ok: false,
      reason: "unavailable",
      cause: "missing_secret",
      errorCodes: [],
      hostname: null,
      status: null,
    };

    const response = await POST(
      createRequest({
        ...validMembershipApplicationPayload,
        captchaToken: "token-from-turnstile",
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to verify captcha.",
    });
    expect(insertedValues).toHaveLength(0);
  });

  test("preserves the existing validation response", async () => {
    const { POST } = await routeModulePromise;
    const response = await POST(
      createRequest({
        ...validMembershipApplicationPayload,
        email: "not-an-email",
      }),
    );

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

  test("preserves the existing 500 response for unexpected insert failures", async () => {
    const { POST } = await routeModulePromise;

    insertError = new Error("db failed");

    const response = await POST(
      createRequest(validMembershipApplicationPayload),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to create membership application.",
    });
  });
});
