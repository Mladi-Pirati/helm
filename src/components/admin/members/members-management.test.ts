import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

describe("members management table implementation", () => {
  test("renders members through TanStack Table instead of the virtualized grid", () => {
    const source = readFileSync(
      "src/components/admin/members/members-management.tsx",
      "utf8",
    );

    expect(source).toContain("useReactTable");
    expect(source).toContain("getCoreRowModel");
    expect(source).toContain("type ColumnDef");
    expect(source).toContain("TableHeader");
    expect(source).toContain("TableBody");
    expect(source).not.toContain("@tanstack/react-virtual");
    expect(source).not.toContain("useVirtualizer");
  });

  test("renders URL-backed header controls for sorting and filtering", () => {
    const source = readFileSync(
      "src/components/admin/members/members-management.tsx",
      "utf8",
    );

    expect(source).toContain("buildMembersSortHref");
    expect(source).toContain("ArrowDownAZIcon");
    expect(source).toContain("ArrowUpZAIcon");
    expect(source).toContain("FilterIcon");
    expect(source).toContain("DialogTrigger");
    expect(source).toContain("Checkbox");
    expect(source).toContain("data-filter-active");
    expect(source).toContain("...props");
    expect(source).toContain("roleOptions.length > 12");
    expect(source).toContain('"max-h-[70vh] overflow-y-auto pr-1"');
    expect(source).toContain('"overflow-visible"');
    expect(source).not.toContain("SelectTrigger");
    expect(source).toContain("Status");
    expect(source).toContain("Roles");
  });

  test("wires row selection to the welcome email bulk action", () => {
    const source = readFileSync(
      "src/components/admin/members/members-management.tsx",
      "utf8",
    );

    expect(source).toContain("type RowSelectionState");
    expect(source).toContain("enableRowSelection: canResendWelcomeEmail");
    expect(source).toContain("Select all visible members");
    expect(source).toContain("Select member");
    expect(source).toContain("DropdownMenu");
    expect(source).toContain("Bulk actions");
    expect(source).toContain("Resend welcome email");
    expect(source).toContain("BulkResendWelcomeEmailDialog");
    expect(source).toContain("bulkResendWelcomeEmailAction");
  });

  test("keeps table headers visible when there are no rows", () => {
    const source = readFileSync(
      "src/components/admin/members/members-management.tsx",
      "utf8",
    );

    expect(source).toContain("colSpan={columns.length}");
    expect(source).toContain("No members match the current filters.");
    expect(source).not.toContain(
      '<CardContent className="px-0">\n        {table.getRowModel().rows.length ? (',
    );
  });

  test("locks and clears Keycloak-derived add-member fields", () => {
    const source = readFileSync(
      "src/components/admin/members/members-management.tsx",
      "utf8",
    );

    expect(source).toContain("function clearSelectedUser()");
    expect(source).toContain("firstName: \"\"");
    expect(source).toContain("lastName: \"\"");
    expect(source).toContain("primaryEmail: \"\"");
    expect(source).toContain("username: \"\"");
    expect(source).toContain("disabled={Boolean(selectedUser)}");
    expect(source).toContain("disabled={Boolean(selectedUser?.email)}");
  });

  test("shared table headers default to extra-bold text", () => {
    const source = readFileSync("src/components/ui/table.tsx", "utf8");

    expect(source).toContain("font-extrabold");
    expect(source).not.toContain("font-medium whitespace-nowrap");
  });
});
