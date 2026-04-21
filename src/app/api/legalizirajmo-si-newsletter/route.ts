import { NextResponse } from "next/server";

import { db } from "@/db";
import { legalizirajmoSiNewsletterSubscriptions } from "@/db/schema";
import { createCorsPreflightResponse, withCors } from "@/lib/api/cors";
import { legalizirajmoSiNewsletterSchema } from "@/lib/validation/legalizirajmo-si-newsletter";

const NEWSLETTER_METHODS = ["POST", "OPTIONS"] as const;

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function POST(request: Request) {
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

  try {
    await db.insert(legalizirajmoSiNewsletterSubscriptions).values({
      email: parsedBody.data.email,
      rawPayload:
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>)
          : {},
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
