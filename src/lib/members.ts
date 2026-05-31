export const DEFAULT_MEMBERS_PAGE_SIZE = 50;
export const MAX_MEMBERS_PAGE_SIZE = 100;
export const NO_ROLES_MEMBER_ROLE_FILTER = "__none";

export const memberListStatuses = ["active", "disabled", "all"] as const;
export type MemberListStatus = (typeof memberListStatuses)[number];
export const memberListSorts = ["name-asc", "name-desc"] as const;
export type MemberListSort = (typeof memberListSorts)[number];

export type MembersSearchParams = {
  page?: string | string[];
  pageSize?: string | string[];
  q?: string | string[];
  roleId?: string | string[];
  sort?: string | string[];
  status?: string | string[];
};

export type MembersListFilters = {
  page: number;
  pageSize: number;
  q: string;
  roleId: string[];
  sort: MemberListSort;
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

function parseRoleIds(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(
    new Set(values.map((roleId) => roleId.trim()).filter(Boolean)),
  );
}

export function parseMembersFilters(
  params: MembersSearchParams,
): MembersListFilters {
  const rawPage = firstParam(params.page);
  const rawPageSize = firstParam(params.pageSize);
  const rawSort = firstParam(params.sort);
  const rawStatus = firstParam(params.status);
  const pageSize = parsePositiveInt(rawPageSize, DEFAULT_MEMBERS_PAGE_SIZE);

  return {
    page: parsePositiveInt(rawPage, 1),
    pageSize: Math.min(pageSize, MAX_MEMBERS_PAGE_SIZE),
    q: firstParam(params.q)?.trim() ?? "",
    roleId: parseRoleIds(params.roleId),
    sort: memberListSorts.includes(rawSort as MemberListSort)
      ? (rawSort as MemberListSort)
      : "name-asc",
    status: memberListStatuses.includes(rawStatus as MemberListStatus)
      ? (rawStatus as MemberListStatus)
      : "active",
  };
}

export function buildMembersQueryString(filters: MembersListFilters) {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "active") params.set("status", filters.status);
  for (const roleId of filters.roleId) params.append("roleId", roleId);
  if (filters.sort !== "name-asc") params.set("sort", filters.sort);
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
  updates: Partial<
    Pick<MembersListFilters, "q" | "roleId" | "sort" | "status">
  >,
) {
  return buildMembersListHref({
    ...filters,
    ...updates,
    page: 1,
  });
}

export function buildMembersSortHref(filters: MembersListFilters) {
  return buildMembersFilterHref(filters, {
    sort: filters.sort === "name-asc" ? "name-desc" : "name-asc",
  });
}
