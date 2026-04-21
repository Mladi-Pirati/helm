import { NextResponse } from "next/server";

import { db } from "@/db";
import { mladiPiratiMembershipApplications } from "@/db/schema";
import { createCorsPreflightResponse, withCors } from "@/lib/api/cors";
import { membershipApplicationSchema } from "@/lib/validation/membership-application";

const MEMBERSHIP_APPLICATION_METHODS = ["POST", "OPTIONS"] as const;

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
      { methods: MEMBERSHIP_APPLICATION_METHODS },
    );
  }

  const parsedBody = membershipApplicationSchema.safeParse(body);

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
      { methods: MEMBERSHIP_APPLICATION_METHODS },
    );
  }

  try {
    const {
      fullName,
      dateOfBirth,
      placeOfBirth,
      streetAddress,
      cityAndPostalCode,
      residenceRegion,
      email,
      phone,
      participationMode,
      discordUsername,
      motivation,
      consentsToDataProcessing,
      acceptsStatuteAndProgram,
    } = parsedBody.data;

    const [createdApplication] = await db
      .insert(mladiPiratiMembershipApplications)
      .values({
        fullName,
        dateOfBirth,
        placeOfBirth,
        streetAddress,
        cityAndPostalCode,
        residenceRegion,
        email,
        phone: phone ?? null,
        participationMode,
        discordUsername: discordUsername ?? null,
        motivation: motivation ?? null,
        consentsToDataProcessing,
        acceptsStatuteAndProgram,
        status: "new",
        rawPayload:
          typeof body === "object" && body !== null
            ? (body as Record<string, unknown>)
            : {},
      })
      .returning({
        id: mladiPiratiMembershipApplications.id,
        status: mladiPiratiMembershipApplications.status,
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
