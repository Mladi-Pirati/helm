export const residenceRegions = [
  "Pomurska",
  "Podravska",
  "Koroška",
  "Savinjska",
  "Zasavska",
  "Posavska",
  "Jugovzhodna Slovenija",
  "Osrednjeslovenska",
  "Gorenjska",
  "Primorsko-notranjska",
  "Goriška",
  "Obalno-kraška",
] as const;

export type ResidenceRegion = (typeof residenceRegions)[number];

export const membershipApplicationStatuses = [
  "pending",
  "approved",
  "rejected",
] as const;

export type MembershipApplicationStatus =
  (typeof membershipApplicationStatuses)[number];

export const membershipApplicationStatusLabels: Record<
  MembershipApplicationStatus,
  string
> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const reviewMembershipApplicationStatuses = [
  "approved",
  "rejected",
] as const;

export type ReviewMembershipApplicationStatus =
  (typeof reviewMembershipApplicationStatuses)[number];

export const bulkMembershipApplicationActions = [
  "approve",
  "reject",
  "pending",
  "delete",
] as const;

export type BulkMembershipApplicationAction =
  (typeof bulkMembershipApplicationActions)[number];

export const DEFAULT_MEMBERSHIP_APPLICATIONS_PAGE_SIZE = 50;
export const MAX_MEMBERSHIP_APPLICATIONS_PAGE_SIZE = 100;

export type MembershipApplicationsSearchParams = {
  page?: string | Array<string> | undefined;
  pageSize?: string | Array<string> | undefined;
  q?: string | Array<string> | undefined;
  status?: string | Array<string> | undefined;
};

export type MembershipApplicationsListFilters = {
  page: number;
  pageSize: number;
  q: string;
  status?: MembershipApplicationStatus;
};

function getSingleSearchParam(
  value: string | Array<string> | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function isMembershipApplicationStatus(
  value: string | undefined,
): value is MembershipApplicationStatus {
  return membershipApplicationStatuses.includes(
    value as MembershipApplicationStatus,
  );
}

export function parseMembershipApplicationsFilters(
  rawSearchParams: MembershipApplicationsSearchParams,
): MembershipApplicationsListFilters {
  const rawPage = getSingleSearchParam(rawSearchParams.page);
  const rawPageSize = getSingleSearchParam(rawSearchParams.pageSize);
  const pageSize = parsePositiveInt(
    rawPageSize,
    DEFAULT_MEMBERSHIP_APPLICATIONS_PAGE_SIZE,
  );
  const q = getSingleSearchParam(rawSearchParams.q)?.trim() ?? "";
  const status = getSingleSearchParam(rawSearchParams.status);

  return {
    page: parsePositiveInt(rawPage, 1),
    pageSize: Math.min(pageSize, MAX_MEMBERSHIP_APPLICATIONS_PAGE_SIZE),
    q,
    status:
      status === undefined
        ? "pending"
        : isMembershipApplicationStatus(status)
          ? status
          : undefined,
  };
}

export function buildMembershipApplicationsQueryString(
  filters: MembershipApplicationsListFilters,
) {
  const searchParams = new URLSearchParams();

  if (filters.q) {
    searchParams.set("q", filters.q);
  }

  if (filters.status === undefined) {
    searchParams.set("status", "");
  } else if (filters.status !== "pending") {
    searchParams.set("status", filters.status);
  }

  if (filters.page > 1) {
    searchParams.set("page", String(filters.page));
  }

  if (filters.pageSize !== DEFAULT_MEMBERSHIP_APPLICATIONS_PAGE_SIZE) {
    searchParams.set("pageSize", String(filters.pageSize));
  }

  return searchParams.toString();
}

export function buildMembershipApplicationsListHref(
  filters: MembershipApplicationsListFilters,
) {
  const queryString = buildMembershipApplicationsQueryString(filters);

  return queryString
    ? `/admin/members/applications?${queryString}`
    : "/admin/members/applications";
}

export function buildMembershipApplicationsFilterHref(
  filters: MembershipApplicationsListFilters,
  updates: Partial<Pick<MembershipApplicationsListFilters, "q" | "status">>,
) {
  return buildMembershipApplicationsListHref({
    ...filters,
    ...updates,
    page: 1,
  });
}

export function buildMembershipApplicationDetailsHref(
  applicationId: string,
  queryString: string,
) {
  return queryString
    ? `/admin/members/applications/${applicationId}?${queryString}`
    : `/admin/members/applications/${applicationId}`;
}

export function getRejectionReasonWordCount(value: string) {
  const words = value.trim().match(/\S+/g);

  return words?.length ?? 0;
}

export function hasValidRejectionReason(value: string) {
  return getRejectionReasonWordCount(value) >= 4;
}

export function formatPendingMembershipApplicationCount(count: number) {
  return count > 99 ? "99+" : count.toString();
}

export function dedupeMembershipApplicationIds(applicationIds: Array<string>) {
  return Array.from(
    new Set(
      applicationIds
        .map((applicationId) => applicationId.trim())
        .filter(Boolean),
    ),
  );
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function buildBulkMembershipApplicationActionMessage({
  action,
  affectedCount,
  memberCreationFailureCount,
}: {
  action: BulkMembershipApplicationAction;
  affectedCount: number;
  memberCreationFailureCount: number;
}) {
  const applicationNoun = pluralize(
    affectedCount,
    "application",
    "applications",
  );

  switch (action) {
    case "approve": {
      const baseMessage = `Approved ${affectedCount} ${applicationNoun}.`;

      if (memberCreationFailureCount <= 0) {
        return baseMessage;
      }

      const profileNoun = pluralize(
        memberCreationFailureCount,
        "member profile needs",
        "member profiles need",
      );

      return `${baseMessage} ${memberCreationFailureCount} ${profileNoun} retry.`;
    }
    case "reject":
      return `Rejected ${affectedCount} ${applicationNoun}.`;
    case "pending":
      return `Set ${affectedCount} ${applicationNoun} back to pending.`;
    case "delete":
      return `Deleted ${affectedCount} ${applicationNoun}.`;
    default:
      return `Updated ${affectedCount} ${applicationNoun}.`;
  }
}

export function getMembershipApplicationStatusVariant(
  status: MembershipApplicationStatus,
) {
  switch (status) {
    case "approved":
      return "default";
    case "pending":
      return "secondary";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}
