import { desc } from "drizzle-orm";

import { MembershipApplicationsManagement } from "@/components/admin/membership-applications/membership-applications-management";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { mladiPiratiMembershipApplications } from "@/db/schema";
import { getCurrentUserPermissions } from "@/lib/auth/permissions";
import {
  buildMembershipApplicationsQueryString,
  membershipApplicationStatusLabels,
  membershipApplicationStatuses,
  parseMembershipApplicationsFilters,
  type MembershipApplicationsSearchParams,
  type ParticipationMode,
  type ResidenceRegion,
} from "@/lib/membership-applications";
import { buildMembershipApplicationsWhere } from "@/lib/membership-applications-query";

import { FilterSelect } from "./filter-select";

export default async function AdminMembershipApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<MembershipApplicationsSearchParams>;
}) {
  const { permissions } = await getCurrentUserPermissions();
  const filters = parseMembershipApplicationsFilters(await searchParams);
  const queryString = buildMembershipApplicationsQueryString(filters);
  const whereClause = buildMembershipApplicationsWhere(filters);
  const canDelete = permissions.includes("members.delete");

  const exportCsvHref = queryString
    ? `/api/admin/membership-applications/export/csv?${queryString}`
    : "/api/admin/membership-applications/export/csv";
  const exportEmailsHref = queryString
    ? `/api/admin/membership-applications/export/emails?${queryString}`
    : "/api/admin/membership-applications/export/emails";
  const exportPdfHref = queryString
    ? `/api/admin/membership-applications/export/pdf?${queryString}`
    : "/api/admin/membership-applications/export/pdf";

  const baseQuery = db
    .select({
      id: mladiPiratiMembershipApplications.id,
      firstName: mladiPiratiMembershipApplications.firstName,
      lastName: mladiPiratiMembershipApplications.lastName,
      cityAndPostalCode:
        mladiPiratiMembershipApplications.cityAndPostalCode,
      residenceRegion: mladiPiratiMembershipApplications.residenceRegion,
      email: mladiPiratiMembershipApplications.email,
      participationMode: mladiPiratiMembershipApplications.participationMode,
      status: mladiPiratiMembershipApplications.status,
      createdAt: mladiPiratiMembershipApplications.createdAt,
    })
    .from(mladiPiratiMembershipApplications);

  const rows = await (whereClause
    ? baseQuery.where(whereClause)
    : baseQuery
  ).orderBy(desc(mladiPiratiMembershipApplications.createdAt));

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">Membership applications</h1>
          <p className="text-xs text-muted-foreground">
            Review applications from a stable server-filtered queue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={exportCsvHref}>Export CSV</a>
          </Button>
          <Button asChild variant="outline">
            <a href={exportEmailsHref}>Export Emails CSV</a>
          </Button>
          <Button asChild variant="outline">
            <a href={exportPdfHref}>Export PDFs (ZIP)</a>
          </Button>
        </div>
      </div>

      <form className="grid gap-3 rounded-none border p-4 sm:grid-cols-3">
        <input
          className="h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 sm:col-span-2"
          defaultValue={filters.q}
          name="q"
          placeholder="Search by name, email, city, or phone"
          type="search"
        />
        <FilterSelect
          defaultValue={filters.status}
          name="status"
          options={membershipApplicationStatuses.map((status) => ({
            label: membershipApplicationStatusLabels[status],
            value: status,
          }))}
          placeholder="All statuses"
        />
      </form>

      <MembershipApplicationsManagement
        canDelete={canDelete}
        queryString={queryString}
        rows={rows.map((row) => ({
          ...row,
          participationMode: row.participationMode as ParticipationMode,
          residenceRegion: row.residenceRegion as ResidenceRegion,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
