import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

describe("roles management rank editor", () => {
  test("uses dnd kit for visual role ordering", () => {
    const source = readFileSync(
      "src/components/admin/roles/roles-management.tsx",
      "utf8",
    );

    expect(source).toContain("DragDropProvider");
    expect(source).toContain("useSortable");
    expect(source).toContain("move(");
    expect(source).toContain("reorderRolesAction");
  });

  test("locks roles at or above the current user's highest rank", () => {
    const source = readFileSync(
      "src/components/admin/roles/roles-management.tsx",
      "utf8",
    );

    expect(source).toContain("highestManagedRank");
    expect(source).toContain("isLocked");
    expect(source).toContain("LockIcon");
    expect(source).toContain("!isLocked");
  });

  test("role sheets do not render editable rank fields", () => {
    const addSource = readFileSync(
      "src/components/admin/roles/add-role-sheet.tsx",
      "utf8",
    );
    const editSource = readFileSync(
      "src/components/admin/roles/edit-role-sheet.tsx",
      "utf8",
    );

    expect(addSource).not.toContain('name="rank"');
    expect(editSource).not.toContain('name="rank"');
    expect(addSource).not.toContain('type="number"');
    expect(editSource).not.toContain('type="number"');
  });
});
