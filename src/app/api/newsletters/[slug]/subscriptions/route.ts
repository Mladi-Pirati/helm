import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { newsletters, newsletterSubscriptions } from "@/db/schema";
import { createCorsPreflightResponse, withCors } from "@/lib/api/cors";
import { sendDiscordEmbedNotification } from "@/lib/api/discord-webhook";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestClientIp } from "@/lib/api/request-client-ip";
import { verifyTurnstileToken } from "@/lib/api/turnstile";
import { newsletterSubscriptionSchema } from "@/lib/validation/newsletters";

const NEWSLETTER_METHODS = ["POST", "OPTIONS"] as const;
const NEWSLETTER_RATE_LIMIT = {
  scope: "newsletter_submit",
  limit: 10,
  windowMs: 10 * 60 * 1000,
} as const;

type NewsletterLogDetails = Record<
  string,
  boolean | number | string | Array<string> | null | undefined
>;

function logNewsletterEvent(
  level: "info" | "warn" | "error",
  message: string,
  details: NewsletterLogDetails,
) {
  console[level]("[newsletter-subscribe]", {
    message,
    ...details,
  });
}

function isUniqueViolation(error: unknown) {
  let currentError: unknown = error;

  while (typeof currentError === "object" && currentError !== null) {
    if ("code" in currentError && currentError.code === "23505") {
      return true;
    }

    if (!("cause" in currentError)) {
      return false;
    }

    currentError = currentError.cause;
  }

  return false;
}

function getCaptchaToken(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      hasCaptchaToken: false,
      captchaToken: null,
    };
  }

  if (!Object.prototype.hasOwnProperty.call(body, "captchaToken")) {
    return {
      hasCaptchaToken: false,
      captchaToken: null,
    };
  }

  const captchaToken = (body as Record<string, unknown>).captchaToken;

  if (typeof captchaToken !== "string") {
    return {
      hasCaptchaToken: true,
      captchaToken: null,
    };
  }

  const trimmedCaptchaToken = captchaToken.trim();

  return {
    hasCaptchaToken: true,
    captchaToken: trimmedCaptchaToken ? trimmedCaptchaToken : null,
  };
}

function getRawPayload(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {};
  }

  const rawPayload = { ...(body as Record<string, unknown>) };
  delete rawPayload.captchaToken;

  return rawPayload;
}

function redactEmailDomain(email: string) {
  const [localPart] = email.split("@");
  return `${localPart}@<redacted>`;
}

function createCaptchaRequiredResponse(
  request: Request,
  retryAfterSeconds: number | null,
) {
  return withCors(
    request,
    NextResponse.json(
      {
        code: "captcha_required",
        message: "Complete the captcha challenge and try again.",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(retryAfterSeconds ?? 1),
        },
      },
    ),
    { methods: NEWSLETTER_METHODS },
  );
}

function createCaptchaInvalidResponse(request: Request) {
  return withCors(
    request,
    NextResponse.json(
      {
        code: "captcha_invalid",
        message: "Captcha verification failed. Please try again.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    ),
    { methods: NEWSLETTER_METHODS },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const newsletter = await db.query.newsletters.findFirst({
    where: sql`lower(${newsletters.slug}) = ${slug.toLowerCase()}`,
    columns: {
      id: true,
      name: true,
      slug: true,
      archivedAt: true,
    },
  });

  if (!newsletter) {
    return withCors(
      request,
      NextResponse.json(
        {
          error: "Newsletter not found.",
        },
        { status: 404 },
      ),
      { methods: NEWSLETTER_METHODS },
    );
  }

  if (newsletter.archivedAt) {
    return withCors(
      request,
      NextResponse.json(
        {
          error: "This newsletter is archived and no longer accepts submissions.",
        },
        { status: 410 },
      ),
      { methods: NEWSLETTER_METHODS },
    );
  }

  const { rateLimited, retryAfterSeconds } = await checkRateLimit(
    request,
    NEWSLETTER_RATE_LIMIT,
  );
  const clientIp = getRequestClientIp(request);

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return withCors(
      request,
      NextResponse.json(
        {
          error: "Invalid JSON body.",
        },
        { status: 400 },
      ),
      { methods: NEWSLETTER_METHODS },
    );
  }

  const { hasCaptchaToken, captchaToken } = getCaptchaToken(body);
  const parsedBody = newsletterSubscriptionSchema.safeParse(body);

  if (rateLimited || hasCaptchaToken) {
    logNewsletterEvent("info", "Parsed newsletter signup request.", {
      rateLimited,
      retryAfterSeconds,
      hasCaptchaToken,
      captchaTokenPresent: captchaToken !== null,
      clientIpPresent: clientIp !== null,
      newsletterSlug: newsletter.slug,
    });
  }

  if (!parsedBody.success) {
    if (rateLimited || hasCaptchaToken) {
      logNewsletterEvent("warn", "Returning validation error response.", {
        branch: "validation_failed",
        hasCaptchaToken,
        rateLimited,
        newsletterSlug: newsletter.slug,
      });
    }

    return withCors(
      request,
      NextResponse.json(
        {
          error: "Validation failed.",
          fieldErrors: parsedBody.error.flatten().fieldErrors,
        },
        { status: 400 },
      ),
      { methods: NEWSLETTER_METHODS },
    );
  }

  let hasValidCaptcha = false;

  if (hasCaptchaToken) {
    if (!captchaToken) {
      logNewsletterEvent(
        "warn",
        "Returning captcha_invalid for empty captcha.",
        {
          branch: "captcha_invalid",
          reason: "missing_token_value",
          rateLimited,
          newsletterSlug: newsletter.slug,
        },
      );

      return createCaptchaInvalidResponse(request);
    }

    let turnstileVerification: Awaited<ReturnType<typeof verifyTurnstileToken>>;

    try {
      turnstileVerification = await verifyTurnstileToken(captchaToken, {
        remoteIp: clientIp,
      });
    } catch (error) {
      logNewsletterEvent(
        "error",
        "Turnstile verification threw unexpectedly.",
        {
          branch: "captcha_verification_unavailable",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          newsletterSlug: newsletter.slug,
        },
      );

      return withCors(
        request,
        NextResponse.json(
          {
            error: "Unable to verify captcha.",
          },
          { status: 500 },
        ),
        { methods: NEWSLETTER_METHODS },
      );
    }

    if (!turnstileVerification.ok) {
      if (turnstileVerification.reason === "invalid") {
        logNewsletterEvent("warn", "Returning captcha_invalid response.", {
          branch: "captcha_invalid",
          errorCodes: turnstileVerification.errorCodes,
          hostname: turnstileVerification.hostname,
          rateLimited,
          newsletterSlug: newsletter.slug,
        });

        return createCaptchaInvalidResponse(request);
      }

      logNewsletterEvent("error", "Captcha verification is unavailable.", {
        branch: "captcha_verification_unavailable",
        cause: turnstileVerification.cause,
        errorCodes: turnstileVerification.errorCodes,
        hostname: turnstileVerification.hostname,
        status: turnstileVerification.status,
        newsletterSlug: newsletter.slug,
      });

      return withCors(
        request,
        NextResponse.json(
          {
            error: "Unable to verify captcha.",
          },
          { status: 500 },
        ),
        { methods: NEWSLETTER_METHODS },
      );
    }

    logNewsletterEvent("info", "Captcha verification succeeded.", {
      branch: "captcha_valid",
      hostname: turnstileVerification.hostname,
      rateLimited,
      newsletterSlug: newsletter.slug,
    });

    hasValidCaptcha = true;
  }

  if (rateLimited && !hasValidCaptcha) {
    logNewsletterEvent("info", "Returning captcha_required response.", {
      branch: "captcha_required",
      retryAfterSeconds,
      hasCaptchaToken,
      newsletterSlug: newsletter.slug,
    });

    return createCaptchaRequiredResponse(request, retryAfterSeconds);
  }

  try {
    await db.insert(newsletterSubscriptions).values({
      newsletterId: newsletter.id,
      email: parsedBody.data.email,
      rawPayload: getRawPayload(body),
    });

    if (hasValidCaptcha || rateLimited) {
      logNewsletterEvent("info", "Newsletter signup succeeded.", {
        branch: hasValidCaptcha ? "subscribed_after_captcha" : "subscribed",
        rateLimited,
        newsletterSlug: newsletter.slug,
      });
    }

    await sendDiscordEmbedNotification({
      title: "New Newsletter Signup",
      description: `A new ${newsletter.name} newsletter signup was received.`,
      adminPath: `/admin/newsletters/${newsletter.slug}`,
      color: 0xf59e0b,
      fields: [
        {
          name: "Newsletter",
          value: newsletter.name,
          inline: true,
        },
        {
          name: "Email",
          value: redactEmailDomain(parsedBody.data.email),
          inline: true,
        },
      ],
    });

    return withCors(
      request,
      new Response(null, {
        status: 204,
      }),
      { methods: NEWSLETTER_METHODS },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      if (hasValidCaptcha || rateLimited) {
        logNewsletterEvent(
          "info",
          "Returning duplicate subscription response.",
          {
            branch: "duplicate",
            rateLimited,
            hasValidCaptcha,
            newsletterSlug: newsletter.slug,
          },
        );
      }

      return withCors(
        request,
        NextResponse.json(
          {
            error: "That email address is already subscribed.",
            fieldErrors: {
              email: ["That email address is already subscribed."],
            },
          },
          { status: 409 },
        ),
        { methods: NEWSLETTER_METHODS },
      );
    }

    logNewsletterEvent("error", "Unexpected newsletter subscription failure.", {
      branch: "internal_error",
      hasValidCaptcha,
      rateLimited,
      newsletterSlug: newsletter.slug,
    });

    return withCors(
      request,
      NextResponse.json(
        {
          error: "Unable to create newsletter subscription.",
        },
        { status: 500 },
      ),
      { methods: NEWSLETTER_METHODS },
    );
  }
}

export function OPTIONS(request: Request) {
  return createCorsPreflightResponse(request, {
    methods: NEWSLETTER_METHODS,
  });
}
