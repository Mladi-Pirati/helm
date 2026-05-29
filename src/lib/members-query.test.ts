import { describe, expect, test } from "bun:test";

import { getPrimaryEmailForMember } from "@/lib/members-query";

describe("member query email selection", () => {
  test("chooses the primary email contact for a member", () => {
    expect(
      getPrimaryEmailForMember("member-1", [
        {
          isPrimary: false,
          memberId: "member-1",
          sortOrder: 0,
          value: "secondary@example.test",
        },
        {
          isPrimary: true,
          memberId: "member-1",
          sortOrder: 1,
          value: "primary@example.test",
        },
        {
          isPrimary: true,
          memberId: "member-2",
          sortOrder: 0,
          value: "other@example.test",
        },
      ]),
    ).toBe("primary@example.test");
  });
});
