import { desc } from "drizzle-orm";
import { format } from "date-fns";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { mladiPiratiMembershipApplications } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import {
  membershipApplicationStatusLabels,
  parseMembershipApplicationsFilters,
  participationModeLabels,
  type ParticipationMode,
  type MembershipApplicationStatus,
} from "@/lib/membership-applications";
import { buildMembershipApplicationsWhere } from "@/lib/membership-applications-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CSV_HEADERS = [
  "id",
  "createdAt",
  "updatedAt",
  "status",
  "fullName",
  "dateOfBirth",
  "placeOfBirth",
  "streetAddress",
  "cityAndPostalCode",
  "residenceRegion",
  "email",
  "phone",
  "participationMode",
  "discordUsername",
  "motivation",
  "consentsToDataProcessing",
  "acceptsStatuteAndProgram",
] as const;

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue =
    value instanceof Date ? value.toISOString() : String(value);

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function toCsvRow(values: readonly unknown[]): string {
  return values.map(escapeCsvField).join(",");
}

export async function GET(request: NextRequest) {
  await requireAdmin();

  const rawSearchParams = Object.fromEntries(
    request.nextUrl.searchParams.entries(),
  );
  const filters = parseMembershipApplicationsFilters(rawSearchParams);
  const whereClause = buildMembershipApplicationsWhere(filters);

  const baseQuery = db
    .select({
      id: mladiPiratiMembershipApplications.id,
      createdAt: mladiPiratiMembershipApplications.createdAt,
      updatedAt: mladiPiratiMembershipApplications.updatedAt,
      status: mladiPiratiMembershipApplications.status,
      fullName: mladiPiratiMembershipApplications.fullName,
      dateOfBirth: mladiPiratiMembershipApplications.dateOfBirth,
      placeOfBirth: mladiPiratiMembershipApplications.placeOfBirth,
      streetAddress: mladiPiratiMembershipApplications.streetAddress,
      cityAndPostalCode: mladiPiratiMembershipApplications.cityAndPostalCode,
      residenceRegion: mladiPiratiMembershipApplications.residenceRegion,
      email: mladiPiratiMembershipApplications.email,
      phone: mladiPiratiMembershipApplications.phone,
      participationMode: mladiPiratiMembershipApplications.participationMode,
      discordUsername: mladiPiratiMembershipApplications.discordUsername,
      motivation: mladiPiratiMembershipApplications.motivation,
      consentsToDataProcessing:
        mladiPiratiMembershipApplications.consentsToDataProcessing,
      acceptsStatuteAndProgram:
        mladiPiratiMembershipApplications.acceptsStatuteAndProgram,
    })
    .from(mladiPiratiMembershipApplications);

  const rows = await (whereClause
    ? baseQuery.where(whereClause)
    : baseQuery
  ).orderBy(desc(mladiPiratiMembershipApplications.createdAt));

  const bodyLines: string[] = [toCsvRow(CSV_HEADERS)];

  for (const row of rows) {
    const status = row.status as MembershipApplicationStatus;
    const participationMode = row.participationMode as ParticipationMode;

    bodyLines.push(
      toCsvRow([
        row.id,
        row.createdAt,
        row.updatedAt,
        membershipApplicationStatusLabels[status],
        row.fullName,
        row.dateOfBirth,
        row.placeOfBirth,
        row.streetAddress,
        row.cityAndPostalCode,
        row.residenceRegion,
        row.email,
        row.phone,
        participationModeLabels[participationMode],
        row.discordUsername,
        row.motivation,
        row.consentsToDataProcessing ? "true" : "false",
        row.acceptsStatuteAndProgram ? "true" : "false",
      ]),
    );
  }

  const body = "\uFEFF" + bodyLines.join("\r\n") + "\r\n";
  const filename = `membership-applications-${format(new Date(), "yyyy-MM-dd")}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
