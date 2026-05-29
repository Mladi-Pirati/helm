import { describe, expect, test } from "bun:test";
import { count } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";
import { NO_ROLES_MEMBER_ROLE_FILTER } from "@/lib/members";
import {
  buildMembersWhere,
  getPrimaryEmailForMember,
} from "@/lib/members-query";

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

describe("member query role filtering", () => {
  test("encodes no-roles timestamp params for postgres", () => {
    const where = buildMembersWhere(
      {
        page: 1,
        pageSize: 50,
        q: "",
        roleId: NO_ROLES_MEMBER_ROLE_FILTER,
        status: "active",
      },
      new Date("2026-05-29T11:19:10.399Z"),
    );

    const query = db
      .select({ value: count() })
      .from(members)
      .where(where)
      .toSQL();

    expect(query.params).toEqual(["2026-05-29T11:19:10.399Z"]);
  });
});
