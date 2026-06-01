import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

describe("membership applications management table implementation", () => {
  test("renders applications through TanStack Table and Virtual", () => {
    const source = readFileSync(
      "src/components/admin/membership-applications/membership-applications-management.tsx",
      "utf8",
    );

    expect(source).toContain("useReactTable");
    expect(source).toContain("getCoreRowModel");
    expect(source).toContain("type ColumnDef");
    expect(source).toContain("@tanstack/react-virtual");
    expect(source).toContain("useVirtualizer");
    expect(source).toContain("getVirtualItems");
    expect(source).toContain("TableScrollContainer");
    expect(source).toContain(
      "getScrollElement: () => scrollContainerRef.current",
    );
  });

  test("renders pagination controls without header filters", () => {
    const source = readFileSync(
      "src/components/admin/membership-applications/membership-applications-management.tsx",
      "utf8",
    );

    expect(source).toContain("Page {page} of {pageCount}");
    expect(source).toContain("Per page");
    expect(source).toContain("previousPageHref");
    expect(source).toContain("nextPageHref");
    expect(source).not.toContain("FilterIcon");
    expect(source).not.toContain("buildMembershipApplicationsFilterHref");
    expect(source).not.toContain("data-filter-active");
  });

  test("keeps table headers visible when there are no rows", () => {
    const source = readFileSync(
      "src/components/admin/membership-applications/membership-applications-management.tsx",
      "utf8",
    );

    expect(source).toContain("colSpan={columns.length}");
    expect(source).toContain(
      '<TableScrollContainer\n          className="max-h-[calc(100dvh-28rem)]"\n          ref={scrollContainerRef}\n        >',
    );
    expect(source).toContain("No applications match the current filters.");
    expect(source).not.toContain(
      '<CardContent className="px-0">\n        {table.getRowModel().rows.length ? (',
    );
  });
});
