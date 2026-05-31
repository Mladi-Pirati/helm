import { desc, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArchiveNewsletterDialog } from "@/components/admin/newsletters/archive-newsletter-dialog";
import { EditNewsletterSheet } from "@/components/admin/newsletters/edit-newsletter-sheet";
import { NewsletterSubscriptionsManagement } from "@/components/admin/newsletters/newsletter-subscriptions-management";
import { UnarchiveNewsletterDialog } from "@/components/admin/newsletters/unarchive-newsletter-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/db";
import { newsletters, newsletterSubscriptions } from "@/db/schema";
import { getCurrentUserPermissions } from "@/lib/auth/permissions";
import {
  buildNewsletterSubscriptionListHref,
  buildNewsletterSubscriptionQueryString,
  parseNewsletterSubscriptionFilters,
  type NewsletterSearchParams,
} from "@/lib/newsletters";
import { buildNewsletterSubscriptionWhere } from "@/lib/newsletters-query";

export default async function AdminNewsletterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<NewsletterSearchParams>;
}) {
  const { permissions } = await getCurrentUserPermissions();
  const { slug } = await params;
  const newsletter = await db.query.newsletters.findFirst({
    where: sql`lower(${newsletters.slug}) = ${slug.toLowerCase()}`,
    columns: {
      id: true,
      name: true,
      slug: true,
      description: true,
      archivedAt: true,
    },
  });

  if (!newsletter) {
    notFound();
  }

  const filters = parseNewsletterSubscriptionFilters(await searchParams);
  const queryString = buildNewsletterSubscriptionQueryString(filters);
  const canManage = permissions.includes("newsletters.update");
  const canDelete = canManage && !newsletter.archivedAt;

  const exportCsvHref = queryString
    ? `/api/admin/newsletters/${newsletter.slug}/export/csv?${queryString}`
    : `/api/admin/newsletters/${newsletter.slug}/export/csv`;

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

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-2">
          <Button asChild className="w-fit" size="xs" variant="outline">
            <Link href="/admin/newsletters">Back to newsletters</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{newsletter.name}</h1>
            {newsletter.archivedAt ? (
              <Badge variant="outline">Archived</Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {newsletter.description}
          </p>
          {newsletter.archivedAt ? (
            <p className="text-xs font-medium text-muted-foreground">
              Archived newsletters cannot accept new submissions and their
              submissions cannot be deleted.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={exportCsvHref}>Export CSV</a>
          </Button>
          {canManage ? (
            <>
              <EditNewsletterSheet newsletter={newsletter} />
              {newsletter.archivedAt ? (
                <UnarchiveNewsletterDialog newsletter={newsletter} />
              ) : (
                <ArchiveNewsletterDialog newsletter={newsletter} />
              )}
            </>
          ) : null}
        </div>
      </div>

      <form className="grid gap-3 rounded-none border p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          defaultValue={filters.q}
          name="q"
          placeholder="Search by email"
          type="search"
        />
        <div className="flex gap-2">
          <Button type="submit">Apply filters</Button>
          <Button asChild variant="outline">
            <Link href={buildNewsletterSubscriptionListHref(newsletter.slug, "")}>
              Clear
            </Link>
          </Button>
        </div>
      </form>

      <NewsletterSubscriptionsManagement
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
