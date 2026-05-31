import { sendResendEmail } from "@/lib/email/resend";

const SUBJECT = "Dobrodošel_a med Mladimi Pirati";
const ACCENT_COLOR = "#f0a000";
const DISCORD_INVITE_URL = "https://discord.gg/jqS7QFpc2C";

export type MembershipApprovalEmailInput = {
  applicationId: string;
  email: string;
  firstName: string;
};

export type MembershipApprovalEmailSender = {
  send(input: MembershipApprovalEmailInput): Promise<boolean>;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildMembershipApprovalEmail({
  firstName,
}: MembershipApprovalEmailInput) {
  const safeFirstName = escapeHtml(firstName.trim() || "član");

  const text = [
    `Živjo, ${firstName.trim() || "član_ica"}!`,
    "",
    "Tvoja prijava za članstvo v Mladih Piratih je bila odobrena.",
    "Ustvarili smo tvoj članski račun. V ločenem Keycloak e-sporočilu boš prejel_a povezavo za potrditev e-poštnega naslova in nastavitev gesla.",
    "",
    "Pridruži se nam tudi na Discordu:",
    DISCORD_INVITE_URL,
    "",
    "Dobrodošel_a v ekipi.",
    "",
    "Mladi Pirati",
  ].join("\n");

  const html = `
<!doctype html>
<html>
  <body style="margin:0;background:#000000;color:#ffffff;font-family:&quot;JetBrains Mono&quot;, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;">
    <div style="box-sizing:border-box;width:100%;max-width:680px;margin:0 auto;padding:48px 24px;background:#000000;color:#ffffff;font-family:&quot;JetBrains Mono&quot;, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;">
      <div style="box-sizing:border-box;border:2px solid ${ACCENT_COLOR};padding:36px 28px;background:#050505;color:#ffffff;">
        <p style="margin:0 0 28px 0;color:${ACCENT_COLOR};font-size:15px;line-height:1.6;font-weight:700;letter-spacing:0;text-transform:uppercase;">Mladi Pirati</p>
        <p style="margin:0 0 22px 0;color:#ffffff;font-size:18px;line-height:1.8;font-weight:500;">Živjo, <span style="color:${ACCENT_COLOR};font-weight:800;">${safeFirstName}</span>!</p>
        <p style="margin:0 0 22px 0;color:#ffffff;font-size:18px;line-height:1.8;font-weight:500;">Tvoja prijava za članstvo v Mladih Piratih je bila odobrena.</p>
        <p style="margin:0 0 30px 0;color:#ffffff;font-size:18px;line-height:1.8;font-weight:500;">Ustvarili smo tvoj članski račun. V ločenem Keycloak e-sporočilu boš prejel_a povezavo za potrditev e-poštnega naslova in nastavitev gesla.</p>
        <p style="margin:0 0 16px 0;color:#ffffff;font-size:18px;line-height:1.8;font-weight:600;">Pridruži se nam tudi na Discordu.</p>
        <a href="${DISCORD_INVITE_URL}" style="display:inline-block;margin:0 0 34px 0;padding:14px 18px;background:${ACCENT_COLOR};color:#000000;font-size:18px;line-height:1.4;font-weight:800;text-decoration:none;">Odpri Discord</a>
        <div style="height:4px;width:96px;background:${ACCENT_COLOR};margin:0 0 34px 0;"></div>
        <p style="margin:0 0 8px 0;color:#ffffff;font-size:18px;line-height:1.8;font-weight:600;">Dobrodošel_a v ekipi.</p>
        <p style="margin:0;color:${ACCENT_COLOR};font-size:18px;line-height:1.8;font-weight:800;">Mladi Pirati</p>
      </div>
    </div>
  </body>
</html>`.trim();

  return {
    html,
    subject: SUBJECT,
    text,
  };
}

export async function sendMembershipApprovalEmail(
  input: MembershipApprovalEmailInput,
) {
  const email = buildMembershipApprovalEmail(input);

  return sendResendEmail({
    html: email.html,
    idempotencyKey: `membership-approval/${input.applicationId}`,
    subject: email.subject,
    tags: [
      { name: "category", value: "membership_approval" },
      { name: "application_id", value: input.applicationId },
    ],
    text: email.text,
    to: input.email,
  });
}
