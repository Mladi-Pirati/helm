export type NewsletterSearchParams = {
  q?: string | string[] | undefined;
};

export type NewsletterSubscriptionListFilters = {
  q: string;
};

function getSingleSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseNewsletterSubscriptionFilters(
  rawSearchParams: NewsletterSearchParams,
): NewsletterSubscriptionListFilters {
  return {
    q: getSingleSearchParam(rawSearchParams.q)?.trim() ?? "",
  };
}

export function buildNewsletterSubscriptionQueryString(
  filters: NewsletterSubscriptionListFilters,
) {
  const searchParams = new URLSearchParams();

  if (filters.q) {
    searchParams.set("q", filters.q);
  }

  return searchParams.toString();
}

export function buildNewsletterSubscriptionListHref(
  slug: string,
  queryString: string,
) {
  return queryString
    ? `/admin/newsletters/${slug}?${queryString}`
    : `/admin/newsletters/${slug}`;
}

export function createNewsletterSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
