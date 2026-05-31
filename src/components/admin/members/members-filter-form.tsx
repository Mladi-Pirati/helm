"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  buildMembersFilterHref,
  type MembersListFilters,
} from "@/lib/members";

export function MembersFilterForm({
  filters,
}: {
  filters: MembersListFilters;
}) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentFilters, setCurrentFilters] = useState(filters);
  const [query, setQuery] = useState(filters.q);

  const applyFilters = useCallback(
    (updates: Partial<Pick<MembersListFilters, "q">>) => {
      const baseFilters = {
        ...currentFilters,
        q: query,
      };
      const nextFilters = {
        ...baseFilters,
        ...updates,
        page: 1,
      };

      setCurrentFilters(nextFilters);
      router.replace(buildMembersFilterHref(baseFilters, updates), {
        scroll: false,
      });
    },
    [currentFilters, query, router],
  );

  useEffect(() => {
    if (query === currentFilters.q) return;

    debounceRef.current = setTimeout(() => {
      applyFilters({ q: query });
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [applyFilters, currentFilters.q, query]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    applyFilters({ q: query });
  }

  return (
    <form
      className="grid gap-3 rounded-none border p-4 md:grid-cols-2"
      onSubmit={submitSearch}
    >
      <input
        className="h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 md:col-span-2"
        name="q"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name, username, email, or Keycloak id"
        type="search"
        value={query}
      />
    </form>
  );
}
