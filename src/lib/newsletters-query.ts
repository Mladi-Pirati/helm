import { and, eq, ilike, type SQL } from "drizzle-orm";

import { newsletterSubscriptions } from "@/db/schema";
import type { NewsletterSubscriptionListFilters } from "@/lib/newsletters";

export function buildNewsletterSubscriptionWhere(
  newsletterId: string,
  filters: NewsletterSubscriptionListFilters,
): SQL<unknown> {
  const newsletterPredicate = eq(
    newsletterSubscriptions.newsletterId,
    newsletterId,
  );

  if (!filters.q) {
    return newsletterPredicate;
  }

  return and(
    newsletterPredicate,
    ilike(newsletterSubscriptions.email, `%${filters.q}%`),
  ) as SQL<unknown>;
}
