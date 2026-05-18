import { describe, expect, test } from "bun:test";

import { getRejectionReasonWordCount, hasValidRejectionReason } from "./membership-applications";

describe("membership application rejection reasons", () => {
  test("counts words after trimming repeated whitespace", () => {
    expect(getRejectionReasonWordCount("  missing   required\ninformation  ")).toBe(3);
  });

  test("requires at least four words", () => {
    expect(hasValidRejectionReason("missing required information")).toBe(false);
    expect(hasValidRejectionReason("missing required application information")).toBe(
      true,
    );
  });
});
