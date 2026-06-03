import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.restore();

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

type MockNewsletter = {
  id: string;
  name: string;
  slug: string;
  archivedAt: Date | null;
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
let mockNewsletters = new Map<string, MockNewsletter>();

const newslettersTable = Symbol("newsletters");
const newsletterSubscriptionsTable = Symbol("newsletterSubscriptions");
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalDiscordWebhook = process.env.DISCORD_WEBHOOK;
const originalAdminHost = process.env.ADMIN_HOST;
const originalFetch = globalThis.fetch;

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
  query: {
    newsletters: {
      async findFirst() {
        return mockNewsletters.get(currentSlug) ?? null;
      },
    },
  },
  insert(table: unknown) {
    expect(table).toBe(newsletterSubscriptionsTable);

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

let currentSlug = "legalizirajmo-si";

mock.module("@/db", () => ({ db }));
mock.module("@/db/schema", () => ({
  newsletters: newslettersTable,
  newsletterSubscriptions: newsletterSubscriptionsTable,
}));
mock.module("@/lib/api/rate-limit", () => ({ checkRateLimit }));
mock.module("@/lib/api/turnstile", () => ({ verifyTurnstileToken }));

const routeModulePromise = import("./route");

function createRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request(
    `https://example.com/api/newsletters/${currentSlug}/subscriptions`,
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

function getContext(slug = currentSlug) {
  currentSlug = slug;

  return {
    params: Promise.resolve({ slug }),
  };
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

beforeEach(() => {
  currentSlug = "legalizirajmo-si";
  mockNewsletters = new Map([
    [
      "legalizirajmo-si",
      {
        id: "newsletter-1",
        name: "legalizirajmo.si",
        slug: "legalizirajmo-si",
        archivedAt: null,
      },
    ],
    [
      "other",
      {
        id: "newsletter-2",
        name: "Other Newsletter",
        slug: "other",
        archivedAt: null,
      },
    ],
  ]);
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

describe("POST /api/newsletters/[slug]/subscriptions", () => {
  test("returns 204 for a normal valid signup without captcha", async () => {
    const { POST } = await routeModulePromise;
    const response = await POST(
      createRequest({ email: "newsletter@example.com" }),
      getContext(),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(insertedValues).toEqual([
      {
        newsletterId: "newsletter-1",
        email: "newsletter@example.com",
        rawPayload: {
          email: "newsletter@example.com",
        },
      },
    ]);
    expect(turnstileCalls).toHaveLength(0);

    const discordPayload = getDiscordPayload();
    expect(fetchCalls[0].input).toBe("https://discord.test/webhook");
    expect(fetchCalls[0].init?.method).toBe("POST");
    expect(discordPayload.embeds).toHaveLength(1);
    expect(discordPayload.embeds[0]).toMatchObject({
      title: "New Newsletter Signup",
      description: "A new legalizirajmo.si newsletter signup was received.",
      url: "https://admin.test/admin/newsletters/legalizirajmo-si",
      color: 0xf59e0b,
      fields: [
        {
          name: "Newsletter",
          value: "legalizirajmo.si",
          inline: true,
        },
        {
          name: "Email",
          value: "newsletter@<redacted>",
          inline: true,
        },
      ],
    });
    expect(discordPayload.embeds[0].timestamp).toEqual(expect.any(String));
    expect(
      Number.isNaN(Date.parse(discordPayload.embeds[0].timestamp ?? "")),
    ).toBe(false);
    expect(JSON.stringify(discordPayload)).not.toContain("example.com");
  });

  test("returns 404 for an unknown newsletter slug", async () => {
    const { POST } = await routeModulePromise;
    const response = await POST(
      createRequest({ email: "newsletter@example.com" }),
      getContext("missing"),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Newsletter not found.",
    });
    expect(insertedValues).toHaveLength(0);
    expect(fetchCalls).toHaveLength(0);
  });

  test("returns 410 for an archived newsletter slug", async () => {
    const { POST } = await routeModulePromise;
    mockNewsletters.set("legalizirajmo-si", {
      id: "newsletter-1",
      name: "legalizirajmo.si",
      slug: "legalizirajmo-si",
      archivedAt: new Date("2026-05-18T00:00:00.000Z"),
    });

    const response = await POST(
      createRequest({ email: "newsletter@example.com" }),
      getContext(),
    );

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: "This newsletter is archived and no longer accepts submissions.",
    });
    expect(insertedValues).toHaveLength(0);
    expect(fetchCalls).toHaveLength(0);
  });

  test("allows the same email to be inserted for different newsletters", async () => {
    const { POST } = await routeModulePromise;

    const firstResponse = await POST(
      createRequest({ email: "newsletter@example.com" }),
      getContext("legalizirajmo-si"),
    );
    const secondResponse = await POST(
      createRequest({ email: "newsletter@example.com" }),
      getContext("other"),
    );

    expect(firstResponse.status).toBe(204);
    expect(secondResponse.status).toBe(204);
    expect(insertedValues).toEqual([
      {
        newsletterId: "newsletter-1",
        email: "newsletter@example.com",
        rawPayload: {
          email: "newsletter@example.com",
        },
      },
      {
        newsletterId: "newsletter-2",
        email: "newsletter@example.com",
        rawPayload: {
          email: "newsletter@example.com",
        },
      },
    ]);
  });

  test("returns 429 captcha_required when the normal rate limit is exceeded", async () => {
    const { POST } = await routeModulePromise;

    rateLimitResult = {
      rateLimited: true,
      retryAfterSeconds: 17,
    };

    const response = await POST(
      createRequest({ email: "newsletter@example.com" }),
      getContext(),
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
          email: "newsletter@example.com",
          captchaToken: "token-from-turnstile",
        },
        {
          "x-forwarded-for": "203.0.113.10, 70.41.3.18",
        },
      ),
      getContext(),
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
        newsletterId: "newsletter-1",
        email: "newsletter@example.com",
        rawPayload: {
          email: "newsletter@example.com",
        },
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
        email: "newsletter@example.com",
        captchaToken: "expired-token",
      }),
      getContext(),
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
        email: "newsletter@example.com",
        captchaToken: "   ",
      }),
      getContext(),
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
        email: "newsletter@example.com",
        captchaToken: "token-from-turnstile",
      }),
      getContext(),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to verify captcha.",
    });
    expect(insertedValues).toHaveLength(0);
    expect(fetchCalls).toHaveLength(0);
  });

  test("preserves the duplicate-email 409 response", async () => {
    const { POST } = await routeModulePromise;

    insertError = {
      code: "23505",
    };

    const response = await POST(
      createRequest({ email: "newsletter@example.com" }),
      getContext(),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "That email address is already subscribed.",
      fieldErrors: {
        email: ["That email address is already subscribed."],
      },
    });
    expect(fetchCalls).toHaveLength(0);
  });

  test("preserves the existing invalid-email validation response", async () => {
    const { POST } = await routeModulePromise;
    const response = await POST(
      createRequest({ email: "not-an-email" }),
      getContext(),
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

  test("returns 204 when the Discord webhook request fails", async () => {
    const { POST } = await routeModulePromise;

    fetchResponse = new Error("discord failed");

    const response = await POST(
      createRequest({ email: "newsletter@example.com" }),
      getContext(),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(fetchCalls).toHaveLength(1);
  });

  test("returns 204 and sends a Discord embed without a URL when ADMIN_HOST is missing", async () => {
    const { POST } = await routeModulePromise;

    delete process.env.ADMIN_HOST;

    const response = await POST(
      createRequest({ email: "newsletter@example.com" }),
      getContext(),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");

    const discordPayload = getDiscordPayload();
    expect(discordPayload.embeds[0].url).toBeUndefined();
    expect(discordPayload.embeds[0].fields).toEqual([
      {
        name: "Newsletter",
        value: "legalizirajmo.si",
        inline: true,
      },
      {
        name: "Email",
        value: "newsletter@<redacted>",
        inline: true,
      },
    ]);
  });

  test("responds to CORS preflight", async () => {
    const { OPTIONS } = await routeModulePromise;
    const response = OPTIONS(
      new Request("https://example.com/api/newsletters/other/subscriptions", {
        method: "OPTIONS",
        headers: {
          Origin: "https://legalizirajmo.si",
          "Access-Control-Request-Method": "POST",
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "POST",
    );
  });
});
