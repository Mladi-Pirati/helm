import { NextResponse } from "next/server";

import { db } from "@/db";
import { mladiPiratiMembershipApplications } from "@/db/schema";
import { createCorsPreflightResponse, withCors } from "@/lib/api/cors";
import { sendDiscordEmbedNotification } from "@/lib/api/discord-webhook";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestClientIp } from "@/lib/api/request-client-ip";
import { verifyTurnstileToken } from "@/lib/api/turnstile";
import { membershipApplicationSchema } from "@/lib/validation/membership-application";

const MEMBERSHIP_APPLICATION_METHODS = ["POST", "OPTIONS"] as const;
const MEMBERSHIP_APPLICATION_RATE_LIMIT = {
  scope: "membership_application_submit",
  limit: 100,
  windowMs: 10 * 60 * 1000,
} as const;

type MembershipApplicationLogDetails = Record<
  string,
  boolean | number | string | Array<string> | null | undefined
>;

function logMembershipApplicationEvent(
  level: "info" | "warn" | "error",
  message: string,
  details: MembershipApplicationLogDetails,
) {
  console[level]("[membership-application]", {
    message,
    ...details,
  });
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
  delete rawPayload.participationMode;

  return rawPayload;
}

function getAgeFromDateOfBirth(dateOfBirth: string) {
  const [birthYear, birthMonth, birthDay] = dateOfBirth
    .split("-")
    .map(Number);
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  if (
    currentMonth < birthMonth ||
    (currentMonth === birthMonth && currentDay < birthDay)
  ) {
    age -= 1;
  }

  return age;
}

function getApplicationDisplayName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
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
    { methods: MEMBERSHIP_APPLICATION_METHODS },
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
    { methods: MEMBERSHIP_APPLICATION_METHODS },
  );
}

export async function POST(request: Request) {
  const { rateLimited, retryAfterSeconds } = await checkRateLimit(
    request,
    MEMBERSHIP_APPLICATION_RATE_LIMIT,
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
      { methods: MEMBERSHIP_APPLICATION_METHODS },
    );
  }

  const { hasCaptchaToken, captchaToken } = getCaptchaToken(body);
  const parsedBody = membershipApplicationSchema.safeParse(body);

  if (rateLimited || hasCaptchaToken) {
    logMembershipApplicationEvent(
      "info",
      "Parsed membership application request.",
      {
        rateLimited,
        retryAfterSeconds,
        hasCaptchaToken,
        captchaTokenPresent: captchaToken !== null,
        clientIpPresent: clientIp !== null,
      },
    );
  }

  if (!parsedBody.success) {
    if (rateLimited || hasCaptchaToken) {
      logMembershipApplicationEvent(
        "warn",
        "Returning validation error response.",
        {
          branch: "validation_failed",
          hasCaptchaToken,
          rateLimited,
        },
      );
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
      { methods: MEMBERSHIP_APPLICATION_METHODS },
    );
  }

  let hasValidCaptcha = false;

  if (hasCaptchaToken) {
    if (!captchaToken) {
      logMembershipApplicationEvent(
        "warn",
        "Returning captcha_invalid for empty captcha.",
        {
          branch: "captcha_invalid",
          reason: "missing_token_value",
          rateLimited,
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
      logMembershipApplicationEvent(
        "error",
        "Turnstile verification threw unexpectedly.",
        {
          branch: "captcha_verification_unavailable",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
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
        { methods: MEMBERSHIP_APPLICATION_METHODS },
      );
    }

    if (!turnstileVerification.ok) {
      if (turnstileVerification.reason === "invalid") {
        logMembershipApplicationEvent(
          "warn",
          "Returning captcha_invalid response.",
          {
            branch: "captcha_invalid",
            errorCodes: turnstileVerification.errorCodes,
            hostname: turnstileVerification.hostname,
            rateLimited,
          },
        );

        return createCaptchaInvalidResponse(request);
      }

      logMembershipApplicationEvent(
        "error",
        "Captcha verification is unavailable.",
        {
          branch: "captcha_verification_unavailable",
          cause: turnstileVerification.cause,
          errorCodes: turnstileVerification.errorCodes,
          hostname: turnstileVerification.hostname,
          status: turnstileVerification.status,
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
        { methods: MEMBERSHIP_APPLICATION_METHODS },
      );
    }

    logMembershipApplicationEvent("info", "Captcha verification succeeded.", {
      branch: "captcha_valid",
      hostname: turnstileVerification.hostname,
      rateLimited,
    });

    hasValidCaptcha = true;
  }

  if (rateLimited && !hasValidCaptcha) {
    logMembershipApplicationEvent(
      "info",
      "Returning captcha_required response.",
      {
        branch: "captcha_required",
        retryAfterSeconds,
        hasCaptchaToken,
      },
    );

    return createCaptchaRequiredResponse(request, retryAfterSeconds);
  }

  try {
    const {
      firstName,
      lastName,
      dateOfBirth,
      placeOfBirth,
      streetAddress,
      cityAndPostalCode,
      residenceRegion,
      email,
      phone,
      discordUsername,
      motivation,
      consentsToDataProcessing,
      acceptsStatuteAndProgram,
    } = parsedBody.data;
    const displayName = getApplicationDisplayName(firstName, lastName);

    const [createdApplication] = await db
      .insert(mladiPiratiMembershipApplications)
      .values({
        firstName,
        lastName,
        dateOfBirth,
        placeOfBirth,
        streetAddress,
        cityAndPostalCode,
        residenceRegion,
        email,
        phone: phone ?? null,
        discordUsername: discordUsername ?? null,
        motivation: motivation ?? null,
        consentsToDataProcessing,
        acceptsStatuteAndProgram,
        status: "pending",
        rawPayload: getRawPayload(body),
      })
      .returning({
        id: mladiPiratiMembershipApplications.id,
        status: mladiPiratiMembershipApplications.status,
      });

    if (hasValidCaptcha || rateLimited) {
      logMembershipApplicationEvent(
        "info",
        "Membership application created successfully.",
        {
          branch: hasValidCaptcha
            ? "created_after_captcha"
            : "created_without_captcha",
          rateLimited,
        },
      );
    }

    await sendDiscordEmbedNotification({
      title: "New Membership Application",
      description: "A new membership application is ready for review.",
      adminPath: "/admin/members/applications",
      color: 0x22c55e,
      fields: [
        {
          name: "Name",
          value: displayName,
          inline: true,
        },
        {
          name: "Age",
          value: String(getAgeFromDateOfBirth(dateOfBirth)),
          inline: true,
        },
        {
          name: "Region",
          value: residenceRegion,
          inline: true,
        },
      ],
    });

    return withCors(
      request,
      NextResponse.json(
        {
          id: createdApplication.id,
          status: createdApplication.status,
        },
        { status: 201 },
      ),
      { methods: MEMBERSHIP_APPLICATION_METHODS },
    );
  } catch {
    logMembershipApplicationEvent(
      "error",
      "Unexpected membership application failure.",
      {
        branch: "internal_error",
        hasValidCaptcha,
        rateLimited,
      },
    );

    return withCors(
      request,
      NextResponse.json(
        {
          error: "Unable to create membership application.",
        },
        { status: 500 },
      ),
      { methods: MEMBERSHIP_APPLICATION_METHODS },
    );
  }
}

export function OPTIONS(request: Request) {
  return createCorsPreflightResponse(request, {
    methods: MEMBERSHIP_APPLICATION_METHODS,
  });
}
