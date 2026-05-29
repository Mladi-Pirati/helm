import { describe, expect, test } from "bun:test";

import {
  formatPendingMembershipApplicationCount,
  getRejectionReasonWordCount,
  hasValidRejectionReason,
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
