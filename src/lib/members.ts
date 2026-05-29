export const DEFAULT_MEMBERS_PAGE_SIZE = 50;
export const MAX_MEMBERS_PAGE_SIZE = 100;

export const memberListStatuses = ["active", "disabled", "all"] as const;
export type MemberListStatus = (typeof memberListStatuses)[number];

export type MembersSearchParams = {
  page?: string | string[];
  pageSize?: string | string[];
  q?: string | string[];
  roleId?: string | string[];
  status?: string | string[];
};

export type MembersListFilters = {
  page: number;
  pageSize: number;
  q: string;
  roleId: string;
  status: MemberListStatus;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function parseMembersFilters(
  params: MembersSearchParams,
): MembersListFilters {
  const rawPage = firstParam(params.page);
  const rawPageSize = firstParam(params.pageSize);
  const rawStatus = firstParam(params.status);
  const pageSize = parsePositiveInt(rawPageSize, DEFAULT_MEMBERS_PAGE_SIZE);

  return {
    page: parsePositiveInt(rawPage, 1),
    pageSize: Math.min(pageSize, MAX_MEMBERS_PAGE_SIZE),
    q: firstParam(params.q)?.trim() ?? "",
    roleId: firstParam(params.roleId)?.trim() ?? "",
    status: memberListStatuses.includes(rawStatus as MemberListStatus)
      ? (rawStatus as MemberListStatus)
      : "active",
  };
}

export function buildMembersQueryString(filters: MembersListFilters) {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "active") params.set("status", filters.status);
  if (filters.roleId) params.set("roleId", filters.roleId);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.pageSize !== DEFAULT_MEMBERS_PAGE_SIZE) {
    params.set("pageSize", String(filters.pageSize));
  }

  return params.toString();
}

export function buildMembersListHref(filters: MembersListFilters) {
  const queryString = buildMembersQueryString(filters);
  return queryString ? `/admin/members?${queryString}` : "/admin/members";
}

export function buildMembersFilterHref(
  filters: MembersListFilters,
  updates: Partial<Pick<MembersListFilters, "q" | "roleId" | "status">>,
) {
  return buildMembersListHref({
    ...filters,
    ...updates,
    page: 1,
  });
}
