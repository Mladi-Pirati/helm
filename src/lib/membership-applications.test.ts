import { describe, expect, test } from "bun:test";

import {
  DEFAULT_MEMBERSHIP_APPLICATIONS_PAGE_SIZE,
  MAX_MEMBERSHIP_APPLICATIONS_PAGE_SIZE,
  buildMembershipApplicationsFilterHref,
  buildMembershipApplicationsListHref,
  buildMembershipApplicationsQueryString,
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
    expect(parseMembershipApplicationsFilters({})).toEqual({
      page: 1,
      pageSize: DEFAULT_MEMBERSHIP_APPLICATIONS_PAGE_SIZE,
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

  test("trims text filters and clamps invalid pagination", () => {
    expect(
      parseMembershipApplicationsFilters({
        page: "-4",
        pageSize: String(MAX_MEMBERSHIP_APPLICATIONS_PAGE_SIZE + 500),
        q: "  ana  ",
        status: "approved",
      }),
    ).toEqual({
      page: 1,
      pageSize: MAX_MEMBERSHIP_APPLICATIONS_PAGE_SIZE,
      q: "ana",
      status: "approved",
    });
  });

  test("builds query strings with pagination and drops defaults", () => {
    expect(
      buildMembershipApplicationsQueryString({
        page: 1,
        pageSize: DEFAULT_MEMBERSHIP_APPLICATIONS_PAGE_SIZE,
        q: "",
        status: "pending",
      }),
    ).toBe("");

    expect(
      buildMembershipApplicationsQueryString({
        page: 3,
        pageSize: 25,
        q: "ana",
        status: undefined,
      }),
    ).toBe("q=ana&status=&page=3&pageSize=25");
  });

  test("builds list hrefs and resets pagination for filter changes", () => {
    expect(
      buildMembershipApplicationsListHref({
        page: 2,
        pageSize: 25,
        q: "ana",
        status: "rejected",
      }),
    ).toBe(
      "/admin/members/applications?q=ana&status=rejected&page=2&pageSize=25",
    );

    expect(
      buildMembershipApplicationsFilterHref(
        {
          page: 4,
          pageSize: 25,
          q: "ana",
          status: "approved",
        },
        {
          q: "",
          status: "pending",
        },
      ),
    ).toBe("/admin/members/applications?pageSize=25");
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
