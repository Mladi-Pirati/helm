type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordEmbedNotification = {
  title: string;
  description?: string;
  adminPath?: string;
  color?: number;
  fields: Array<DiscordEmbedField>;
};

type DiscordWebhookLogDetails = Record<
  string,
  boolean | number | string | null | undefined
>;

function logDiscordWebhookEvent(
  level: "warn" | "error",
  message: string,
  details: DiscordWebhookLogDetails,
) {
  console[level]("[discord-webhook]", {
    message,
    ...details,
  });
}

function getAdminUrl(adminPath: string | undefined) {
  if (!adminPath) {
    return undefined;
  }

  const adminHost = process.env.ADMIN_HOST?.trim();

  if (!adminHost) {
    logDiscordWebhookEvent("warn", "ADMIN_HOST is not configured.", {
      adminPath,
    });
    return undefined;
  }

  return `${adminHost.replace(/\/+$/, "")}${adminPath}`;
}

export async function sendDiscordEmbedNotification({
  title,
  description,
  adminPath,
  color,
  fields,
}: DiscordEmbedNotification) {
  const webhookUrl = process.env.DISCORD_WEBHOOK?.trim();
  const adminUrl = getAdminUrl(adminPath);

  if (!webhookUrl) {
    logDiscordWebhookEvent("warn", "DISCORD_WEBHOOK is not configured.", {
      title,
    });
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [
          {
            title,
            description,
            url: adminUrl,
            color,
            timestamp: new Date().toISOString(),
            fields,
          },
        ],
      }),
    });

    if (!response.ok) {
      logDiscordWebhookEvent(
        "error",
        "Discord webhook returned an unsuccessful response.",
        {
          title,
          status: response.status,
          statusText: response.statusText,
        },
      );
    }
  } catch (error) {
    logDiscordWebhookEvent("error", "Discord webhook request failed.", {
      title,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
