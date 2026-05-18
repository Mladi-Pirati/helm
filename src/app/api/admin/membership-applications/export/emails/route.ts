import { format } from "date-fns";
import { desc } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { mladiPiratiMembershipApplications } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { parseMembershipApplicationsFilters } from "@/lib/membership-applications";
import { buildMembershipApplicationsWhere } from "@/lib/membership-applications-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
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
      email: mladiPiratiMembershipApplications.email,
    })
    .from(mladiPiratiMembershipApplications);

  const rows = await (whereClause
    ? baseQuery.where(whereClause)
    : baseQuery
  ).orderBy(desc(mladiPiratiMembershipApplications.createdAt));

  const body = rows.length
    ? `${rows.map((row) => escapeCsvField(row.email)).join("\r\n")}\r\n`
    : "";
  const filename = `membership-application-emails-${format(new Date(), "yyyy-MM-dd")}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
