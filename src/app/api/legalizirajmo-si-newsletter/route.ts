import { NextResponse } from "next/server";

import { db } from "@/db";
import { legalizirajmoSiNewsletterSubscriptions } from "@/db/schema";
import { createCorsPreflightResponse, withCors } from "@/lib/api/cors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestClientIp } from "@/lib/api/request-client-ip";
import { verifyTurnstileToken } from "@/lib/api/turnstile";
import { legalizirajmoSiNewsletterSchema } from "@/lib/validation/legalizirajmo-si-newsletter";

const NEWSLETTER_METHODS = ["POST", "OPTIONS"] as const;
const NEWSLETTER_RATE_LIMIT = {
  scope: "newsletter_submit",
  limit: 1,
  windowMs: 10 * 60 * 1000,
} as const;

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

export async function POST(request: Request) {
  const { rateLimited, retryAfterSeconds } = await checkRateLimit(
    request,
    NEWSLETTER_RATE_LIMIT,
  );

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
  const parsedBody = legalizirajmoSiNewsletterSchema.safeParse(body);

  if (!parsedBody.success) {
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
      return createCaptchaInvalidResponse(request);
    }

    const turnstileVerification = await verifyTurnstileToken(captchaToken, {
      remoteIp: getRequestClientIp(request),
    });

    if (!turnstileVerification.ok) {
      if (turnstileVerification.reason === "invalid") {
        return createCaptchaInvalidResponse(request);
      }

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

    hasValidCaptcha = true;
  }

  if (rateLimited && !hasValidCaptcha) {
    return createCaptchaRequiredResponse(request, retryAfterSeconds);
  }

  try {
    await db.insert(legalizirajmoSiNewsletterSubscriptions).values({
      email: parsedBody.data.email,
      rawPayload: getRawPayload(body),
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
