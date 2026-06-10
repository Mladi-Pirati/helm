import { createHmac } from "crypto";

const APPROVAL_EVENT_NAME = "membership_application_approved";

export type DiscordApprovalEventInput = {
  applicationId: string;
  approvedAt: Date;
  discordUsername: string | null;
};

type DiscordApprovalEventConfig = {
  adminHost?: string;
  fetch?: typeof fetch;
  now?: () => Date;
  secret?: string;
  webhookUrl?: string;
};

type DiscordApprovalEventLogDetails = Record<
  string,
  boolean | number | string | null | undefined
>;

function logDiscordApprovalEvent(
  level: "warn" | "error",
  message: string,
  details: DiscordApprovalEventLogDetails,
) {
  console[level]("[discord-approval-event]", {
    message,
    ...details,
  });
}

function trimOptionalValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getAdminUrl(adminHost: string | undefined, applicationId: string) {
  const trimmedAdminHost = trimOptionalValue(adminHost);

  if (!trimmedAdminHost) {
    return undefined;
  }

  return `${trimmedAdminHost.replace(/\/+$/, "")}/admin/members/applications/${applicationId}`;
}

function signDiscordApprovalEvent(body: string, timestamp: string, secret: string) {
  return `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`;
}

export async function sendDiscordApprovalEvent(
  input: DiscordApprovalEventInput,
  config: DiscordApprovalEventConfig = {},
) {
  const discordUsername = input.discordUsername?.trim();

  if (!discordUsername) {
    return;
  }

  const webhookUrl = trimOptionalValue(
    config.webhookUrl ?? process.env.DISCORD_BOT_APPROVAL_WEBHOOK_URL,
  );
  const secret = trimOptionalValue(
    config.secret ?? process.env.DISCORD_BOT_APPROVAL_WEBHOOK_SECRET,
  );

  if (!webhookUrl || !secret) {
    logDiscordApprovalEvent(
      "warn",
      "Discord approval webhook is not configured.",
      {
        applicationId: input.applicationId,
        hasSecret: Boolean(secret),
        hasWebhookUrl: Boolean(webhookUrl),
      },
    );
    return;
  }

  const payload = {
    event: APPROVAL_EVENT_NAME,
    eventId: `${APPROVAL_EVENT_NAME.replace(
      /_/g,
      "-",
    )}:${input.applicationId}`,
    applicationId: input.applicationId,
    discordUsername,
    approvedAt: input.approvedAt.toISOString(),
    adminUrl: getAdminUrl(
      config.adminHost ?? process.env.ADMIN_HOST,
      input.applicationId,
    ),
  };
  const body = JSON.stringify(payload);
  const timestamp = (config.now?.() ?? new Date()).toISOString();
  const signature = signDiscordApprovalEvent(body, timestamp, secret);
  const fetchImplementation = config.fetch ?? fetch;

  try {
    const response = await fetchImplementation(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Helm-Signature": signature,
        "X-Helm-Timestamp": timestamp,
      },
      body,
    });

    if (!response.ok) {
      logDiscordApprovalEvent(
        "error",
        "Discord approval webhook returned an unsuccessful response.",
        {
          applicationId: input.applicationId,
          status: response.status,
          statusText: response.statusText,
        },
      );
    }
  } catch (error) {
    logDiscordApprovalEvent("error", "Discord approval webhook request failed.", {
      applicationId: input.applicationId,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
