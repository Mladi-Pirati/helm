"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  NO_ROLES_MEMBER_ROLE_FILTER,
  buildMembersFilterHref,
  type MemberListStatus,
  type MembersListFilters,
} from "@/lib/members";

type RoleOption = {
  id: string;
  name: string;
};

function FilterSelect({
  children,
  name,
  onChange,
  value,
}: {
  children: React.ReactNode;
  name: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  value: string;
}) {
  return (
    <select
      className="h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
      name={name}
      onChange={onChange}
      value={value}
    >
      {children}
    </select>
  );
}

export function MembersFilterForm({
  filters,
  roleOptions,
}: {
  filters: MembersListFilters;
  roleOptions: RoleOption[];
}) {
  const router = useRouter();
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentFilters, setCurrentFilters] = React.useState(filters);
  const [query, setQuery] = React.useState(filters.q);

  React.useEffect(() => {
    setCurrentFilters(filters);
    setQuery(filters.q);
  }, [filters]);

  const applyFilters = React.useCallback(
    (updates: Partial<Pick<MembersListFilters, "q" | "roleId" | "status">>) => {
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

  React.useEffect(() => {
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
      className="grid gap-3 rounded-none border p-4 md:grid-cols-4"
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
      <FilterSelect
        name="status"
        onChange={(event) =>
          applyFilters({ status: event.target.value as MemberListStatus })
        }
        value={currentFilters.status}
      >
        <option value="active">Active members</option>
        <option value="disabled">Disabled members</option>
        <option value="all">All members</option>
      </FilterSelect>
      <FilterSelect
        name="roleId"
        onChange={(event) => applyFilters({ roleId: event.target.value })}
        value={currentFilters.roleId}
      >
        <option value="">All roles</option>
        <option value={NO_ROLES_MEMBER_ROLE_FILTER}>No roles</option>
        {roleOptions.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </FilterSelect>
    </form>
  );
}
