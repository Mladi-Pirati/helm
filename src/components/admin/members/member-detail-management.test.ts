import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";

describe("member detail role assignment UI", () => {
  test("uses direct role toggles without expiry fields or a save button", () => {
    const source = readFileSync(
      "src/components/admin/members/member-detail-management.tsx",
      "utf8",
    );
    const rolesSource = source.slice(
      source.indexOf("function RolesTab"),
      source.indexOf("function ApplicationsTab"),
    );

    expect(rolesSource).toContain("setMemberRoleAssignmentAction");
    expect(rolesSource).toContain("Grant");
    expect(rolesSource).toContain("Remove");
    expect(rolesSource).toContain("Locked");
    expect(rolesSource).not.toContain("Save roles");
    expect(rolesSource).not.toContain("expiresAt");
    expect(rolesSource).not.toContain('type="date"');
  });
});
