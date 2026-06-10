import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { sendDiscordApprovalEvent } from "./approval-events";

const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalWebhookUrl = process.env.DISCORD_BOT_APPROVAL_WEBHOOK_URL;
const originalWebhookSecret = process.env.DISCORD_BOT_APPROVAL_WEBHOOK_SECRET;
const originalAdminHost = process.env.ADMIN_HOST;

let fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
let warnLogs: Array<Array<unknown>> = [];
let errorLogs: Array<Array<unknown>> = [];

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

beforeEach(() => {
  fetchCalls = [];
  warnLogs = [];
  errorLogs = [];
  process.env.DISCORD_BOT_APPROVAL_WEBHOOK_URL = "https://bot.test/approval";
  process.env.DISCORD_BOT_APPROVAL_WEBHOOK_SECRET = "test-secret";
  process.env.ADMIN_HOST = "https://admin.test/";
  console.warn = ((...args: Array<unknown>) => {
    warnLogs.push(args);
  }) as typeof console.warn;
  console.error = ((...args: Array<unknown>) => {
    errorLogs.push(args);
  }) as typeof console.error;
});

afterEach(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  restoreEnvValue("DISCORD_BOT_APPROVAL_WEBHOOK_URL", originalWebhookUrl);
  restoreEnvValue("DISCORD_BOT_APPROVAL_WEBHOOK_SECRET", originalWebhookSecret);
  restoreEnvValue("ADMIN_HOST", originalAdminHost);
});

describe("sendDiscordApprovalEvent", () => {
  test("skips applications without a Discord username", async () => {
    await sendDiscordApprovalEvent(
      {
        applicationId: "application-1",
        approvedAt: new Date("2026-06-07T10:00:00.000Z"),
        discordUsername: "  ",
      },
      {
        fetch: (async (input, init) => {
          fetchCalls.push({ input, init });
          return new Response(null, { status: 204 });
        }) as typeof fetch,
      },
    );

    expect(fetchCalls).toEqual([]);
    expect(warnLogs).toEqual([]);
    expect(errorLogs).toEqual([]);
  });

  test("skips missing webhook configuration with a warning", async () => {
    delete process.env.DISCORD_BOT_APPROVAL_WEBHOOK_URL;

    await sendDiscordApprovalEvent(
      {
        applicationId: "application-1",
        approvedAt: new Date("2026-06-07T10:00:00.000Z"),
        discordUsername: "ana",
      },
      {
        fetch: (async (input, init) => {
          fetchCalls.push({ input, init });
          return new Response(null, { status: 204 });
        }) as typeof fetch,
      },
    );

    expect(fetchCalls).toEqual([]);
    expect(String(warnLogs[0]?.[0])).toBe("[discord-approval-event]");
  });

  test("sends the expected signed approval event payload", async () => {
    await sendDiscordApprovalEvent(
      {
        applicationId: "application-1",
        approvedAt: new Date("2026-06-07T10:00:00.000Z"),
        discordUsername: " ana ",
      },
      {
        fetch: (async (input, init) => {
          fetchCalls.push({ input, init });
          return new Response(null, { status: 204 });
        }) as typeof fetch,
        now: () => new Date("2026-06-07T10:01:00.000Z"),
      },
    );

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.input).toBe("https://bot.test/approval");

    const init = fetchCalls[0]?.init;
    const body = String(init?.body);
    const headers = init?.headers as Record<string, string>;
    const expectedSignature = `sha256=${createHmac("sha256", "test-secret")
      .update("2026-06-07T10:01:00.000Z." + body)
      .digest("hex")}`;

    expect(init?.method).toBe("POST");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Helm-Timestamp"]).toBe("2026-06-07T10:01:00.000Z");
    expect(headers["X-Helm-Signature"]).toBe(expectedSignature);
    expect(JSON.parse(body)).toEqual({
      event: "membership_application_approved",
      eventId: "membership-application-approved:application-1",
      applicationId: "application-1",
      discordUsername: "ana",
      approvedAt: "2026-06-07T10:00:00.000Z",
      adminUrl: "https://admin.test/admin/members/applications/application-1",
    });
  });

  test("logs but does not throw on unsuccessful responses and fetch failures", async () => {
    await expect(
      sendDiscordApprovalEvent(
        {
          applicationId: "application-1",
          approvedAt: new Date("2026-06-07T10:00:00.000Z"),
          discordUsername: "ana",
        },
        {
          fetch: (async () =>
            new Response(null, {
              status: 500,
              statusText: "Server Error",
            })) as typeof fetch,
        },
      ),
    ).resolves.toBeUndefined();

    await expect(
      sendDiscordApprovalEvent(
        {
          applicationId: "application-2",
          approvedAt: new Date("2026-06-07T10:00:00.000Z"),
          discordUsername: "bor",
        },
        {
          fetch: (async () => {
            throw new Error("network down");
          }) as typeof fetch,
        },
      ),
    ).resolves.toBeUndefined();

    expect(errorLogs).toHaveLength(2);
  });
});
