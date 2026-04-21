export type LegalizirajmoSiNewsletterSearchParams = {
  q?: string | string[] | undefined;
};

export type LegalizirajmoSiNewsletterListFilters = {
  q: string;
};

function getSingleSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseLegalizirajmoSiNewsletterFilters(
  rawSearchParams: LegalizirajmoSiNewsletterSearchParams,
): LegalizirajmoSiNewsletterListFilters {
  return {
    q: getSingleSearchParam(rawSearchParams.q)?.trim() ?? "",
  };
}

export function buildLegalizirajmoSiNewsletterQueryString(
  filters: LegalizirajmoSiNewsletterListFilters,
) {
  const searchParams = new URLSearchParams();

  if (filters.q) {
    searchParams.set("q", filters.q);
  }

  return searchParams.toString();
}

export function buildLegalizirajmoSiNewsletterListHref(queryString: string) {
  return queryString
    ? `/admin/legalizirajmo-si-newsletter?${queryString}`
    : "/admin/legalizirajmo-si-newsletter";
}
