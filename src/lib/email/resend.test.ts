import { describe, expect, test } from "bun:test";

import { sendResendEmail } from "@/lib/email/resend";

const payload = {
  html: "<p>Živjo</p>",
  idempotencyKey: "membership-approval/application-1",
  subject: "Dobrodošel_a med Mladimi Pirati",
  text: "Živjo",
  to: "ana@example.test",
};

describe("sendResendEmail", () => {
  test("sends with env config and idempotency options", async () => {
    const sentEmails: Array<{
      options?: { idempotencyKey?: string };
      payload: {
        from: string;
        html: string;
        subject: string;
        text: string;
        to: string | string[];
      };
    }> = [];

    const ok = await sendResendEmail(payload, {
      client: {
        emails: {
          async send(emailPayload, options) {
            sentEmails.push({ options, payload: emailPayload });
            return { data: { id: "email-1" }, error: null };
          },
        },
      },
      env: {
        RESEND_API_KEY: "resend-api-key",
        RESEND_FROM_EMAIL: "Mladi Pirati <noreply@example.test>",
      },
    });

    expect(ok).toBe(true);
    expect(sentEmails).toEqual([
      {
        options: { idempotencyKey: "membership-approval/application-1" },
        payload: {
          from: "Mladi Pirati <noreply@example.test>",
          html: "<p>Živjo</p>",
          subject: "Dobrodošel_a med Mladimi Pirati",
          tags: undefined,
          text: "Živjo",
          to: "ana@example.test",
        },
      },
    ]);
  });

  test("returns false when Resend returns an error", async () => {
    const ok = await sendResendEmail(payload, {
      client: {
        emails: {
          async send() {
            return {
              data: null,
              error: { message: "Rate limited", name: "rate_limit_exceeded" },
            };
          },
        },
      },
      env: {
        RESEND_API_KEY: "resend-api-key",
        RESEND_FROM_EMAIL: "Mladi Pirati <noreply@example.test>",
      },
    });

    expect(ok).toBe(false);
  });

  test("returns false when the request throws", async () => {
    const ok = await sendResendEmail(payload, {
      client: {
        emails: {
          async send() {
            throw new Error("Network unavailable");
          },
        },
      },
      env: {
        RESEND_API_KEY: "resend-api-key",
        RESEND_FROM_EMAIL: "Mladi Pirati <noreply@example.test>",
      },
    });

    expect(ok).toBe(false);
  });
});
