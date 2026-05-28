import { count, desc, eq } from "drizzle-orm";

import { NewslettersManagement } from "@/components/admin/newsletters/newsletters-management";
import { db } from "@/db";
import { newsletters, newsletterSubscriptions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AdminNewslettersPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string | string[] | undefined }>;
}) {
  const currentUser = await getCurrentUser();
  const rawSearchParams = await searchParams;
  const showArchived =
    (Array.isArray(rawSearchParams.archived)
      ? rawSearchParams.archived[0]
      : rawSearchParams.archived) === "1";
  const canManage = currentUser?.role === "admin";

  const rows = await db
    .select({
      id: newsletters.id,
      name: newsletters.name,
      slug: newsletters.slug,
      description: newsletters.description,
      archivedAt: newsletters.archivedAt,
      subscriptionCount: count(newsletterSubscriptions.id),
    })
    .from(newsletters)
    .leftJoin(
      newsletterSubscriptions,
      eq(newsletters.id, newsletterSubscriptions.newsletterId),
    )
    .groupBy(
      newsletters.id,
      newsletters.name,
      newsletters.slug,
      newsletters.description,
      newsletters.archivedAt,
      newsletters.createdAt,
    )
    .orderBy(desc(newsletters.createdAt));

  const mappedRows = rows.map((row) => ({
    ...row,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    subscriptionCount: Number(row.subscriptionCount),
  }));

  return (
    <NewslettersManagement
      activeRows={mappedRows.filter((row) => row.archivedAt === null)}
      archivedRows={mappedRows.filter((row) => row.archivedAt !== null)}
      canManage={canManage}
      showArchived={showArchived}
    />
  );
}
