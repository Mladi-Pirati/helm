import { describe, expect, test } from "bun:test";

import { buildMembershipApprovalEmail } from "@/lib/email/membership-approval";

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
    expect(email.text).toContain("Mladi Pirati");
    expect(email.html).toContain("Živjo,");
    expect(email.html).toContain("Mladi Pirati");
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
