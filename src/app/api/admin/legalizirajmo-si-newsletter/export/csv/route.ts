import { desc } from "drizzle-orm";
import { format } from "date-fns";
import type { NextRequest } from "next/server";

import { db } from "@/db";
import { legalizirajmoSiNewsletterSubscriptions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { parseLegalizirajmoSiNewsletterFilters } from "@/lib/legalizirajmo-si-newsletter";
import { buildLegalizirajmoSiNewsletterWhere } from "@/lib/legalizirajmo-si-newsletter-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CSV_HEADERS = ["id", "email", "createdAt", "updatedAt"] as const;

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
  const filters = parseLegalizirajmoSiNewsletterFilters(rawSearchParams);
  const whereClause = buildLegalizirajmoSiNewsletterWhere(filters);

  const baseQuery = db
    .select({
      id: legalizirajmoSiNewsletterSubscriptions.id,
      email: legalizirajmoSiNewsletterSubscriptions.email,
      createdAt: legalizirajmoSiNewsletterSubscriptions.createdAt,
      updatedAt: legalizirajmoSiNewsletterSubscriptions.updatedAt,
    })
    .from(legalizirajmoSiNewsletterSubscriptions);

  const rows = await (whereClause
    ? baseQuery.where(whereClause)
    : baseQuery
  ).orderBy(desc(legalizirajmoSiNewsletterSubscriptions.createdAt));

  const bodyLines = [toCsvRow(CSV_HEADERS)];

  for (const row of rows) {
    bodyLines.push(
      toCsvRow([row.id, row.email, row.createdAt, row.updatedAt]),
    );
  }

  const body = "\uFEFF" + bodyLines.join("\r\n") + "\r\n";
  const filename = `legalizirajmo-si-newsletter-${format(new Date(), "yyyy-MM-dd")}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
