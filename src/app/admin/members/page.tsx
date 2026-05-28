import Link from "next/link";

import { MembersManagement } from "@/components/admin/members/members-management";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { roles } from "@/db/schema";
import { getCurrentUserPermissions, requirePermission } from "@/lib/auth/permissions";
import {
  buildMembersListHref,
  parseMembersFilters,
  type MembersSearchParams,
} from "@/lib/members";
import { getMembersPage } from "@/lib/members-query";

function FilterSelect({
  children,
  defaultValue,
  name,
}: {
  children: React.ReactNode;
  defaultValue?: string;
  name: string;
}) {
  return (
    <select
      className="h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
      defaultValue={defaultValue ?? ""}
      name={name}
    >
      {children}
    </select>
  );
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<MembersSearchParams>;
}) {
  await requirePermission("members.read");
  const { permissions } = await getCurrentUserPermissions();
  const filters = parseMembersFilters(await searchParams);
  const [{ rows, pageCount, totalCount }, roleOptions] = await Promise.all([
    getMembersPage(filters),
    db
      .select({
        id: roles.id,
        name: roles.name,
      })
      .from(roles)
      .orderBy(roles.rank),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-xs text-muted-foreground">
            Search, review, and manage member records, roles, and access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/members/applications">Applications</Link>
          </Button>
        </div>
      </div>

      <form className="grid gap-3 rounded-none border p-4 md:grid-cols-5">
        <input
          className="h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 md:col-span-2"
          defaultValue={filters.q}
          name="q"
          placeholder="Search name, username, email, or Keycloak id"
          type="search"
        />
        <FilterSelect defaultValue={filters.status} name="status">
          <option value="active">Active members</option>
          <option value="disabled">Disabled members</option>
          <option value="all">All members</option>
        </FilterSelect>
        <FilterSelect defaultValue={filters.roleId} name="roleId">
          <option value="">All roles</option>
          {roleOptions.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect defaultValue={String(filters.pageSize)} name="pageSize">
          <option value="25">25 per page</option>
          <option value="50">50 per page</option>
          <option value="100">100 per page</option>
        </FilterSelect>
        <div className="flex flex-wrap gap-2 md:col-span-5">
          <Button type="submit">Apply filters</Button>
          <Button asChild variant="outline">
            <Link href="/admin/members">Clear</Link>
          </Button>
          <div className="ml-auto flex gap-2">
            <Button asChild variant="outline">
              <Link
                href={buildMembersListHref({
                  ...filters,
                  page: Math.max(1, filters.page - 1),
                })}
              >
                Previous
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link
                href={buildMembersListHref({
                  ...filters,
                  page: Math.min(pageCount, filters.page + 1),
                })}
              >
                Next
              </Link>
            </Button>
          </div>
        </div>
      </form>

      <MembersManagement
        canCreate={permissions.includes("members.create")}
        page={filters.page}
        pageCount={pageCount}
        rows={rows.map((row) => ({
          ...row,
          currentMembership: row.currentMembership
            ? {
                expiresAt:
                  row.currentMembership.expiresAt?.toISOString() ?? null,
                extendedAt: row.currentMembership.extendedAt.toISOString(),
              }
            : null,
          disabledAt: row.disabledAt?.toISOString() ?? null,
          updatedAt: row.updatedAt.toISOString(),
        }))}
        totalCount={totalCount}
      />
    </div>
  );
}
