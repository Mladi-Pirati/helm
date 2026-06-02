import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { mladiPiratiMembershipApplications } from "@/db/schema";
import type { MembershipApplicationsListFilters } from "@/lib/membership-applications";

export function buildMembershipApplicationsWhere(
  filters: MembershipApplicationsListFilters,
): SQL<unknown> | undefined {
  const whereClauses: SQL<unknown>[] = [];

  if (filters.q) {
    const searchPattern = `%${filters.q}%`;

    whereClauses.push(
      or(
        ilike(mladiPiratiMembershipApplications.firstName, searchPattern),
        ilike(mladiPiratiMembershipApplications.lastName, searchPattern),
        ilike(
          sql`${mladiPiratiMembershipApplications.firstName} || ' ' || ${
            mladiPiratiMembershipApplications.lastName
          }`,
          searchPattern,
        ),
        ilike(mladiPiratiMembershipApplications.email, searchPattern),
        ilike(
          mladiPiratiMembershipApplications.cityAndPostalCode,
          searchPattern,
        ),
        ilike(mladiPiratiMembershipApplications.phone, searchPattern),
      )!,
    );
  }

  if (filters.status) {
    whereClauses.push(
      eq(mladiPiratiMembershipApplications.status, filters.status),
    );
  }

  if (whereClauses.length === 0) {
    return undefined;
  }

  if (whereClauses.length === 1) {
    return whereClauses[0];
  }

  return and(...whereClauses);
}

export async function getMembershipApplicationsPage(
  filters: MembershipApplicationsListFilters,
) {
  const where = buildMembershipApplicationsWhere(filters);
  const offset = (filters.page - 1) * filters.pageSize;

  const countQuery = db
    .select({ value: count() })
    .from(mladiPiratiMembershipApplications);
  const [{ value: totalCount }] = await (where
    ? countQuery.where(where)
    : countQuery);

  const baseRowsQuery = db
    .select({
      id: mladiPiratiMembershipApplications.id,
      firstName: mladiPiratiMembershipApplications.firstName,
      lastName: mladiPiratiMembershipApplications.lastName,
      cityAndPostalCode:
        mladiPiratiMembershipApplications.cityAndPostalCode,
      residenceRegion: mladiPiratiMembershipApplications.residenceRegion,
      email: mladiPiratiMembershipApplications.email,
      status: mladiPiratiMembershipApplications.status,
      createdAt: mladiPiratiMembershipApplications.createdAt,
    })
    .from(mladiPiratiMembershipApplications);

  const rows = await (where ? baseRowsQuery.where(where) : baseRowsQuery)
    .orderBy(desc(mladiPiratiMembershipApplications.createdAt))
    .limit(filters.pageSize)
    .offset(offset);

  return {
    pageCount: Math.max(1, Math.ceil(Number(totalCount) / filters.pageSize)),
    rows,
    totalCount: Number(totalCount),
  };
}
