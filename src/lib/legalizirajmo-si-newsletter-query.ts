import { ilike, type SQL } from "drizzle-orm";

import { legalizirajmoSiNewsletterSubscriptions } from "@/db/schema";
import type { LegalizirajmoSiNewsletterListFilters } from "@/lib/legalizirajmo-si-newsletter";

export function buildLegalizirajmoSiNewsletterWhere(
  filters: LegalizirajmoSiNewsletterListFilters,
): SQL<unknown> | undefined {
  if (!filters.q) {
    return undefined;
  }

  return ilike(
    legalizirajmoSiNewsletterSubscriptions.email,
    `%${filters.q}%`,
  );
}
