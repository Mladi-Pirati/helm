import { MembershipApplicationsManagement } from "@/components/admin/membership-applications/membership-applications-management";
import { Button } from "@/components/ui/button";
import { getCurrentUserPermissions } from "@/lib/auth/permissions";
import {
  DEFAULT_MEMBERSHIP_APPLICATIONS_PAGE_SIZE,
  buildMembershipApplicationsListHref,
  buildMembershipApplicationsQueryString,
  membershipApplicationStatusLabels,
  membershipApplicationStatuses,
  parseMembershipApplicationsFilters,
  type MembershipApplicationsSearchParams,
  type ResidenceRegion,
} from "@/lib/membership-applications";
import { getMembershipApplicationsPage } from "@/lib/membership-applications-query";

import { FilterSelect } from "./filter-select";

export default async function AdminMembershipApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<MembershipApplicationsSearchParams>;
}) {
  const { permissions } = await getCurrentUserPermissions();
  const filters = parseMembershipApplicationsFilters(await searchParams);
  const queryString = buildMembershipApplicationsQueryString(filters);
  const canDelete = permissions.includes("members.delete");
  const { rows, pageCount, totalCount } =
    await getMembershipApplicationsPage(filters);

  const exportCsvHref = queryString
    ? `/api/admin/membership-applications/export/csv?${queryString}`
    : "/api/admin/membership-applications/export/csv";
  const exportEmailsHref = queryString
    ? `/api/admin/membership-applications/export/emails?${queryString}`
    : "/api/admin/membership-applications/export/emails";
  const exportPdfHref = queryString
    ? `/api/admin/membership-applications/export/pdf?${queryString}`
    : "/api/admin/membership-applications/export/pdf";

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
        {filters.pageSize !== DEFAULT_MEMBERSHIP_APPLICATIONS_PAGE_SIZE ? (
          <input
            defaultValue={filters.pageSize}
            name="pageSize"
            type="hidden"
          />
        ) : null}
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
        nextPageHref={buildMembershipApplicationsListHref({
          ...filters,
          page: Math.min(pageCount, filters.page + 1),
        })}
        page={filters.page}
        pageCount={pageCount}
        pageSize={filters.pageSize}
        pageSizeOptions={[25, 50, 100].map((pageSize) => ({
          href: buildMembershipApplicationsListHref({
            ...filters,
            page: 1,
            pageSize,
          }),
          value: pageSize,
        }))}
        previousPageHref={buildMembershipApplicationsListHref({
          ...filters,
          page: Math.max(1, filters.page - 1),
        })}
        queryString={queryString}
        rows={rows.map((row) => ({
          ...row,
          residenceRegion: row.residenceRegion as ResidenceRegion,
          createdAt: row.createdAt.toISOString(),
        }))}
        totalCount={totalCount}
      />
    </div>
  );
}
