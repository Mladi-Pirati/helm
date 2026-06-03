import { Resend } from "resend";

type ResendEmailTag = {
  name: string;
  value: string;
};

export type ResendEmailPayload = {
  html: string;
  idempotencyKey: string;
  subject: string;
  tags?: Array<ResendEmailTag>;
  text: string;
  to: string | Array<string>;
};

type ResendEmailClient = {
  emails: {
    send(
      payload: {
        from: string;
        html: string;
        subject: string;
        tags?: Array<ResendEmailTag>;
        text: string;
        to: string | Array<string>;
      },
      options?: { idempotencyKey?: string },
    ): Promise<{
      data: { id: string } | null;
      error: { message?: string; name?: string } | null;
    }>;
  };
};

type SendResendEmailDependencies = {
  client?: ResendEmailClient;
  env?: Record<string, string | undefined>;
};

type EmailLogDetails = Record<string, boolean | number | string | undefined>;

function logResendEmailEvent(
  level: "warn" | "error",
  message: string,
  details: EmailLogDetails,
) {
  console[level]("[resend-email]", {
    message,
    ...details,
  });
}

export async function sendResendEmail(
  payload: ResendEmailPayload,
  dependencies: SendResendEmailDependencies = {},
) {
  const env = dependencies.env ?? process.env;
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    logResendEmailEvent("warn", "Resend email config is incomplete.", {
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
      subject: payload.subject,
    });
    return false;
  }

  const client = dependencies.client ?? new Resend(apiKey);

  try {
    const { data, error } = await client.emails.send(
      {
        from,
        html: payload.html,
        subject: payload.subject,
        tags: payload.tags,
        text: payload.text,
        to: payload.to,
      },
      {
        idempotencyKey: payload.idempotencyKey,
      },
    );

    if (error) {
      logResendEmailEvent("error", "Resend returned an email send error.", {
        errorMessage: error.message,
        errorName: error.name,
        subject: payload.subject,
      });
      return false;
    }

    return Boolean(data?.id);
  } catch (error) {
    logResendEmailEvent("error", "Resend email request failed.", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      subject: payload.subject,
    });
    return false;
  }
}
