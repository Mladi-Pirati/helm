import { desc, sql } from "drizzle-orm";
import { format } from "date-fns";
import type { NextRequest } from "next/server";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { newsletters, newsletterSubscriptions } from "@/db/schema";
import { requireReadyUser } from "@/lib/auth/session";
import { parseNewsletterSubscriptionFilters } from "@/lib/newsletters";
import { buildNewsletterSubscriptionWhere } from "@/lib/newsletters-query";

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

function toCsvRow(values: ReadonlyArray<unknown>): string {
  return values.map(escapeCsvField).join(",");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  await requireReadyUser();

  const { slug } = await params;
  const newsletter = await db.query.newsletters.findFirst({
    where: sql`lower(${newsletters.slug}) = ${slug.toLowerCase()}`,
    columns: {
      id: true,
      slug: true,
    },
  });

  if (!newsletter) {
    notFound();
  }

  const rawSearchParams = Object.fromEntries(
    request.nextUrl.searchParams.entries(),
  );
  const filters = parseNewsletterSubscriptionFilters(rawSearchParams);

  const rows = await db
    .select({
      id: newsletterSubscriptions.id,
      email: newsletterSubscriptions.email,
      createdAt: newsletterSubscriptions.createdAt,
      updatedAt: newsletterSubscriptions.updatedAt,
    })
    .from(newsletterSubscriptions)
    .where(buildNewsletterSubscriptionWhere(newsletter.id, filters))
    .orderBy(desc(newsletterSubscriptions.createdAt));

  const bodyLines = [toCsvRow(CSV_HEADERS)];

  for (const row of rows) {
    bodyLines.push(
      toCsvRow([row.id, row.email, row.createdAt, row.updatedAt]),
    );
  }

  const body = "\uFEFF" + bodyLines.join("\r\n") + "\r\n";
  const filename = `${newsletter.slug}-newsletter-${format(
    new Date(),
    "yyyy-MM-dd",
  )}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
