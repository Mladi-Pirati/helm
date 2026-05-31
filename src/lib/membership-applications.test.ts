import { describe, expect, test } from "bun:test";

import {
  buildBulkMembershipApplicationActionMessage,
  dedupeMembershipApplicationIds,
  formatPendingMembershipApplicationCount,
  getRejectionReasonWordCount,
  hasValidRejectionReason,
  parseMembershipApplicationsFilters,
} from "./membership-applications";

describe("membership application rejection reasons", () => {
  test("counts words after trimming repeated whitespace", () => {
    expect(
      getRejectionReasonWordCount("  missing   required\ninformation  "),
    ).toBe(3);
  });

  test("requires at least four words", () => {
    expect(hasValidRejectionReason("missing required information")).toBe(false);
    expect(
      hasValidRejectionReason("missing required application information"),
    ).toBe(true);
  });
});

describe("pending membership application count", () => {
  test("caps display counts above 99", () => {
    expect(formatPendingMembershipApplicationCount(1)).toBe("1");
    expect(formatPendingMembershipApplicationCount(99)).toBe("99");
    expect(formatPendingMembershipApplicationCount(100)).toBe("99+");
  });
});

describe("membership application list filters", () => {
  test("defaults status filtering to pending when status is absent", () => {
    expect(parseMembershipApplicationsFilters({})).toMatchObject({
      q: "",
      status: "pending",
    });
  });

  test("keeps all statuses selectable with an empty status value", () => {
    expect(parseMembershipApplicationsFilters({ status: "" })).toMatchObject({
      q: "",
      status: undefined,
    });
  });
});

describe("bulk membership application actions", () => {
  test("deduplicates trimmed application ids and drops empty values", () => {
    expect(
      dedupeMembershipApplicationIds([" app-1 ", "", "app-2", "app-1"]),
    ).toEqual(["app-1", "app-2"]);
  });

  test("summarizes bulk approve member creation failures", () => {
    expect(
      buildBulkMembershipApplicationActionMessage({
        action: "approve",
        affectedCount: 8,
        memberCreationFailureCount: 2,
      }),
    ).toBe("Approved 8 applications. 2 member profiles need retry.");
  });

  test("summarizes singular bulk approve member creation failure", () => {
    expect(
      buildBulkMembershipApplicationActionMessage({
        action: "approve",
        affectedCount: 1,
        memberCreationFailureCount: 1,
      }),
    ).toBe("Approved 1 application. 1 member profile needs retry.");
  });

  test("summarizes non-approve bulk actions", () => {
    expect(
      buildBulkMembershipApplicationActionMessage({
        action: "reject",
        affectedCount: 3,
        memberCreationFailureCount: 0,
      }),
    ).toBe("Rejected 3 applications.");
    expect(
      buildBulkMembershipApplicationActionMessage({
        action: "pending",
        affectedCount: 1,
        memberCreationFailureCount: 0,
      }),
    ).toBe("Set 1 application back to pending.");
    expect(
      buildBulkMembershipApplicationActionMessage({
        action: "delete",
        affectedCount: 2,
        memberCreationFailureCount: 0,
      }),
    ).toBe("Deleted 2 applications.");
  });
});
