import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";

type RateLimitResult = {
  rateLimited: boolean;
  retryAfterSeconds: number | null;
};

type TurnstileResult =
  | { ok: true; hostname?: string | null }
  | {
      ok: false;
      reason: "invalid";
      errorCodes?: Array<string>;
      hostname?: string | null;
    }
  | {
      ok: false;
      reason: "unavailable";
      cause?: string;
      errorCodes?: Array<string>;
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
let fetchCalls: Array<{
  input: Parameters<typeof fetch>[0];
  init: Parameters<typeof fetch>[1];
}> = [];
let fetchResponse: Response | Error = new Response(null, { status: 204 });
let createdApplication = {
  id: "application-123",
  status: "pending",
};

const membershipApplicationsTable = {
  id: "id",
  status: "status",
};
const newslettersTable = {
  slug: "slug",
};
const newsletterSubscriptionsTable = {
  id: "id",
};
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalDiscordWebhook = process.env.DISCORD_WEBHOOK;
const originalAdminHost = process.env.ADMIN_HOST;
const originalFetch = globalThis.fetch;

const validMembershipApplicationPayload = {
  firstName: "Ada",
  fullLegalName: "Ada Lovelace",
  lastName: "Lovelace",
  dateOfBirth: "1994-12-10",
  placeOfBirth: "Ljubljana",
  streetAddress: "Pirate Street 10",
  cityAndPostalCode: "1000 Ljubljana",
  residenceRegion: "Osrednjeslovenska",
  email: "ada@example.com",
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
  newsletters: newslettersTable,
  newsletterSubscriptions: newsletterSubscriptionsTable,
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

function getDiscordPayload() {
  expect(fetchCalls).toHaveLength(1);
  const body = fetchCalls[0].init?.body;
  expect(typeof body).toBe("string");

  return JSON.parse(body as string) as {
    embeds: Array<{
      title: string;
      description?: string;
      url?: string;
      color?: number;
      timestamp?: string;
      fields: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
    }>;
  };
}

function getExpectedAge(dateOfBirth: string) {
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  if (
    currentMonth < birthMonth ||
    (currentMonth === birthMonth && currentDay < birthDay)
  ) {
    age -= 1;
  }

  return age;
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
  fetchCalls = [];
  fetchResponse = new Response(null, { status: 204 });
  createdApplication = {
    id: "application-123",
    status: "pending",
  };
  process.env.DISCORD_WEBHOOK = "https://discord.test/webhook";
  process.env.ADMIN_HOST = "https://admin.test/";
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    fetchCalls.push({
      input: args[0],
      init: args[1],
    });

    if (fetchResponse instanceof Error) {
      throw fetchResponse;
    }

    return fetchResponse;
  }) as typeof fetch;
  console.info = (() => {}) as typeof console.info;
  console.warn = (() => {}) as typeof console.warn;
  console.error = (() => {}) as typeof console.error;
});

afterEach(() => {
  if (originalDiscordWebhook === undefined) {
    delete process.env.DISCORD_WEBHOOK;
  } else {
    process.env.DISCORD_WEBHOOK = originalDiscordWebhook;
  }

  if (originalAdminHost === undefined) {
    delete process.env.ADMIN_HOST;
  } else {
    process.env.ADMIN_HOST = originalAdminHost;
  }

  globalThis.fetch = originalFetch;
  console.info = originalConsoleInfo;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

afterAll(() => {
  mock.restore();
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
      status: "pending",
    });
    expect(insertedValues).toEqual([
      {
        ...validMembershipApplicationPayload,
        phone: null,
        discordUsername: null,
        motivation: null,
        status: "pending",
        rawPayload: validMembershipApplicationPayload,
      },
    ]);
    expect(turnstileCalls).toHaveLength(0);

    const discordPayload = getDiscordPayload();
    expect(fetchCalls[0].input).toBe("https://discord.test/webhook");
    expect(fetchCalls[0].init?.method).toBe("POST");
    expect(discordPayload.embeds).toHaveLength(1);
    expect(discordPayload.embeds[0]).toMatchObject({
      title: "New Membership Application",
      description: "A new membership application is ready for review.",
      url: "https://admin.test/admin/members/applications",
      color: 0x22c55e,
      fields: [
        {
          name: "Name",
          value: "Ada Lovelace",
          inline: true,
        },
        {
          name: "Age",
          value: String(
            getExpectedAge(validMembershipApplicationPayload.dateOfBirth),
          ),
          inline: true,
        },
        {
          name: "Region",
          value: "Osrednjeslovenska",
          inline: true,
        },
      ],
    });
    expect(discordPayload.embeds[0].timestamp).toEqual(expect.any(String));
    expect(
      Number.isNaN(Date.parse(discordPayload.embeds[0].timestamp ?? "")),
    ).toBe(false);
    expect(JSON.stringify(discordPayload)).not.toContain("1994-12-10");
    expect(JSON.stringify(discordPayload)).not.toContain("ada@example.com");
    expect(JSON.stringify(discordPayload)).not.toContain("Pirate Street 10");
    expect(JSON.stringify(discordPayload)).not.toContain("Ljubljana");
    expect(JSON.stringify(discordPayload)).not.toContain("rawPayload");
  });

  test("ignores legacy participationMode submissions", async () => {
    const { POST } = await routeModulePromise;
    const legacyPayload = {
      ...validMembershipApplicationPayload,
      participationMode: "Aktiven član (se aktivno udejstvuješ)",
    };
    const response = await POST(createRequest(legacyPayload));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "application-123",
      status: "pending",
    });
    expect(insertedValues).toEqual([
      {
        ...validMembershipApplicationPayload,
        phone: null,
        discordUsername: null,
        motivation: null,
        status: "pending",
        rawPayload: validMembershipApplicationPayload,
      },
    ]);
    expect(JSON.stringify(insertedValues)).not.toContain("participationMode");
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
    expect(fetchCalls).toHaveLength(0);
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
      status: "pending",
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
        status: "pending",
        rawPayload: validMembershipApplicationPayload,
      },
    ]);
    expect(fetchCalls).toHaveLength(1);
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
    expect(fetchCalls).toHaveLength(0);
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
    expect(fetchCalls).toHaveLength(0);
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
    expect(fetchCalls).toHaveLength(0);
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
    expect(fetchCalls).toHaveLength(0);
  });

  test("rejects fullName-only submissions after the split-name API change", async () => {
    const { POST } = await routeModulePromise;
    const response = await POST(
      createRequest({
        fullName: "Ada Lovelace",
        dateOfBirth: validMembershipApplicationPayload.dateOfBirth,
        placeOfBirth: validMembershipApplicationPayload.placeOfBirth,
        streetAddress: validMembershipApplicationPayload.streetAddress,
        cityAndPostalCode:
          validMembershipApplicationPayload.cityAndPostalCode,
        residenceRegion: validMembershipApplicationPayload.residenceRegion,
        email: validMembershipApplicationPayload.email,
        consentsToDataProcessing:
          validMembershipApplicationPayload.consentsToDataProcessing,
        acceptsStatuteAndProgram:
          validMembershipApplicationPayload.acceptsStatuteAndProgram,
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Validation failed.",
      fieldErrors: {
        firstName: ["First name is required."],
        fullLegalName: ["Full legal name is required."],
        lastName: ["Last name is required."],
      },
    });
    expect(insertedValues).toHaveLength(0);
    expect(turnstileCalls).toHaveLength(0);
    expect(fetchCalls).toHaveLength(0);
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
    expect(fetchCalls).toHaveLength(0);
  });

  test("returns 201 when the Discord webhook request fails", async () => {
    const { POST } = await routeModulePromise;

    fetchResponse = new Error("discord failed");

    const response = await POST(
      createRequest(validMembershipApplicationPayload),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "application-123",
      status: "pending",
    });
    expect(fetchCalls).toHaveLength(1);
  });

  test("returns 201 and sends a Discord embed without a URL when ADMIN_HOST is missing", async () => {
    const { POST } = await routeModulePromise;

    delete process.env.ADMIN_HOST;

    const response = await POST(
      createRequest(validMembershipApplicationPayload),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "application-123",
      status: "pending",
    });

    const discordPayload = getDiscordPayload();
    expect(discordPayload.embeds[0].url).toBeUndefined();
    expect(discordPayload.embeds[0].fields).toEqual([
      {
        name: "Name",
        value: "Ada Lovelace",
        inline: true,
      },
      {
        name: "Age",
        value: String(
          getExpectedAge(validMembershipApplicationPayload.dateOfBirth),
        ),
        inline: true,
      },
      {
        name: "Region",
        value: "Osrednjeslovenska",
        inline: true,
      },
    ]);
  });
});
