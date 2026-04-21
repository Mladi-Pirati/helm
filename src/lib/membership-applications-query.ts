import { and, eq, ilike, or, type SQL } from "drizzle-orm";

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
        ilike(mladiPiratiMembershipApplications.fullName, searchPattern),
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

  if (filters.mode) {
    whereClauses.push(
      eq(mladiPiratiMembershipApplications.participationMode, filters.mode),
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
