import { desc } from "drizzle-orm";
import Link from "next/link";

import { LegalizirajmoSiNewsletterManagement } from "@/components/admin/legalizirajmo-si-newsletter/legalizirajmo-si-newsletter-management";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { legalizirajmoSiNewsletterSubscriptions } from "@/db/schema";
import { getCurrentUser, shouldForcePasswordChange } from "@/lib/auth/session";
import {
  buildLegalizirajmoSiNewsletterListHref,
  buildLegalizirajmoSiNewsletterQueryString,
  parseLegalizirajmoSiNewsletterFilters,
  type LegalizirajmoSiNewsletterSearchParams,
} from "@/lib/legalizirajmo-si-newsletter";
import { buildLegalizirajmoSiNewsletterWhere } from "@/lib/legalizirajmo-si-newsletter-query";

export default async function AdminLegalizirajmoSiNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<LegalizirajmoSiNewsletterSearchParams>;
}) {
  const currentUser = await getCurrentUser();
  const filters = parseLegalizirajmoSiNewsletterFilters(await searchParams);
  const queryString = buildLegalizirajmoSiNewsletterQueryString(filters);
  const whereClause = buildLegalizirajmoSiNewsletterWhere(filters);
  const canDelete =
    currentUser?.role === "admin" && !shouldForcePasswordChange(currentUser);

  const exportCsvHref = queryString
    ? `/api/admin/legalizirajmo-si-newsletter/export/csv?${queryString}`
    : "/api/admin/legalizirajmo-si-newsletter/export/csv";

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

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">Legalizirajmo.si Newsletter</h1>
          <p className="text-xs text-muted-foreground">
            Review collected newsletter email subscriptions.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={exportCsvHref}>Export CSV</a>
        </Button>
      </div>

      <form className="grid gap-3 rounded-none border p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input
          className="h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
          defaultValue={filters.q}
          name="q"
          placeholder="Search by email"
          type="search"
        />
        <div className="flex gap-2">
          <Button type="submit">Apply filters</Button>
          <Button asChild variant="outline">
            <Link href={buildLegalizirajmoSiNewsletterListHref("")}>Clear</Link>
          </Button>
        </div>
      </form>

      <LegalizirajmoSiNewsletterManagement
        canDelete={canDelete}
        rows={rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
