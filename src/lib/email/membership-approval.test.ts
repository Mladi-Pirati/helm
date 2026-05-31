import { describe, expect, test } from "bun:test";

import {
  buildMembershipApprovalEmail,
  sendMembershipWelcomeEmail,
} from "@/lib/email/membership-approval";

describe("buildMembershipApprovalEmail", () => {
  test("builds Slovenian subject, html, and plain text content", () => {
    const email = buildMembershipApprovalEmail({
      applicationId: "application-1",
      email: "ana@example.test",
      firstName: "Ana",
    });

    expect(email.subject).toBe("Dobrodošel_a med Mladimi Pirati");
    expect(email.text).toContain("Živjo, Ana!");
    expect(email.text).toContain(
      "Tvoja prijava za članstvo v Mladih Piratih je bila odobrena.",
    );
    expect(email.text).toContain(
      "V ločenem Keycloak e-sporočilu boš prejel_a povezavo",
    );
    expect(email.text).toContain("Pridruži se nam tudi na Discordu:");
    expect(email.text).toContain("https://discord.gg/jqS7QFpc2C");
    expect(email.text).toContain("Mladi Pirati");
    expect(email.html).toContain("Živjo,");
    expect(email.html).toContain("Mladi Pirati");
    expect(email.html).toContain("Odpri Discord");
    expect(email.html).toContain('href="https://discord.gg/jqS7QFpc2C"');
  });

  test("uses the required email styling", () => {
    const email = buildMembershipApprovalEmail({
      applicationId: "application-1",
      email: "ana@example.test",
      firstName: "Ana",
    });

    expect(email.html).toContain("JetBrains Mono");
    expect(email.html).toContain("background:#000000");
    expect(email.html).toContain("color:#ffffff");
    expect(email.html).toContain("#f0a000");
    expect(email.html).toContain("font-size:18px");
    expect(email.html).toContain("line-height:1.8");
    expect(email.html).toContain("border:2px solid #f0a000");
  });

  test("escapes the personalized name in html", () => {
    const email = buildMembershipApprovalEmail({
      applicationId: "application-1",
      email: "ana@example.test",
      firstName: "<Ana & Bine>",
    });

    expect(email.html).toContain("&lt;Ana &amp; Bine&gt;");
    expect(email.html).not.toContain("<Ana & Bine>");
  });
});

describe("sendMembershipWelcomeEmail", () => {
  test("sends a resend welcome email to one recipient without bcc", async () => {
    const calls: Array<{
      options?: { idempotencyKey?: string };
      payload: Record<string, unknown>;
    }> = [];

    const result = await sendMembershipWelcomeEmail(
      {
        email: "ana@example.test",
        firstName: "Ana",
        idempotencyKey: "membership-welcome-resend/member-1/batch-1",
        memberId: "member-1",
      },
      {
        client: {
          emails: {
            async send(payload, options) {
              calls.push({ options, payload });
              return { data: { id: "email-1" }, error: null };
            },
          },
        },
        env: {
          RESEND_API_KEY: "resend-api-key",
          RESEND_FROM_EMAIL: "helm@example.test",
        },
      },
    );

    expect(result).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.payload.to).toBe("ana@example.test");
    expect(calls[0]?.payload).not.toHaveProperty("bcc");
    expect(calls[0]?.options?.idempotencyKey).toBe(
      "membership-welcome-resend/member-1/batch-1",
    );
    expect(calls[0]?.payload.tags).toContainEqual({
      name: "member_id",
      value: "member-1",
    });
  });
});
