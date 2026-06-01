import { describe, expect, test } from "bun:test";
import { count } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";
import { NO_ROLES_MEMBER_ROLE_FILTER } from "@/lib/members";
import {
  buildMembersOrderBy,
  buildMembersWhere,
  getActiveRoleBadgesForMember,
  getAssignedApplicationsForMember,
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

describe("member query inline assignments", () => {
  test("keeps role expiry dates for active role badges", () => {
    expect(
      getActiveRoleBadgesForMember(
        "member-1",
        [
          {
            expiresAt: new Date("2026-06-10T00:00:00.000Z"),
            memberId: "member-1",
            roleId: "role-1",
            roleKey: "regional",
            roleName: "Regional",
          },
          {
            expiresAt: null,
            memberId: "member-1",
            roleId: "role-2",
            roleKey: "trusted",
            roleName: "Trusted",
          },
          {
            expiresAt: null,
            memberId: "member-2",
            roleId: "role-3",
            roleKey: "other",
            roleName: "Other",
          },
        ],
      ),
    ).toEqual([
      {
        expiresAt: new Date("2026-06-10T00:00:00.000Z"),
        id: "role-1",
        key: "regional",
        name: "Regional",
      },
      {
        expiresAt: null,
        id: "role-2",
        key: "trusted",
        name: "Trusted",
      },
    ]);
  });

  test("groups assigned applications for a member", () => {
    expect(
      getAssignedApplicationsForMember("member-1", [
        {
          applicationId: "app-1",
          applicationName: "Forum",
          memberId: "member-1",
        },
        {
          applicationId: "app-2",
          applicationName: "Wiki",
          memberId: "member-2",
        },
      ]),
    ).toEqual([{ id: "app-1", name: "Forum" }]);
  });
});

describe("member query role filtering", () => {
  test("encodes no-roles timestamp params for postgres", () => {
    const where = buildMembersWhere(
      {
        page: 1,
        pageSize: 50,
        q: "",
        roleId: [NO_ROLES_MEMBER_ROLE_FILTER],
        sort: "name-asc",
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

  test("filters by any selected active role", () => {
    const where = buildMembersWhere(
      {
        page: 1,
        pageSize: 50,
        q: "",
        roleId: ["role-1", "role-2"],
        sort: "name-asc",
        status: "active",
      },
      new Date("2026-05-29T11:19:10.399Z"),
    );

    const query = db
      .select({ value: count() })
      .from(members)
      .where(where)
      .toSQL();

    expect(query.sql).toContain('"member_roles"."role_id" in ($1, $2)');
    expect(query.params).toEqual([
      "role-1",
      "role-2",
      "2026-05-29T11:19:10.399Z",
    ]);
  });

  test("combines selected roles and no-role filter with OR logic", () => {
    const where = buildMembersWhere(
      {
        page: 1,
        pageSize: 50,
        q: "",
        roleId: [NO_ROLES_MEMBER_ROLE_FILTER, "role-1"],
        sort: "name-asc",
        status: "all",
      },
      new Date("2026-05-29T11:19:10.399Z"),
    );

    const query = db
      .select({ value: count() })
      .from(members)
      .where(where)
      .toSQL();

    expect(query.sql).toContain("not exists");
    expect(query.sql).toContain('"member_roles"."role_id" in ($2)');
    expect(query.sql).toContain(" or ");
    expect(query.params).toEqual([
      "2026-05-29T11:19:10.399Z",
      "role-1",
      "2026-05-29T11:19:10.399Z",
    ]);
  });
});

describe("member query full-name sorting", () => {
  test("orders members by normalized full name ascending by default", () => {
    const query = db
      .select({ id: members.id })
      .from(members)
      .orderBy(...buildMembersOrderBy("name-asc"))
      .toSQL();

    expect(query.sql).toContain(
      'order by lower(trim(("members"."first_name" || $1 || "members"."last_name"))) asc',
    );
    expect(query.sql).toContain('"members"."username" asc');
    expect(query.sql).toContain('"members"."id" asc');
  });

  test("orders members by normalized full name descending", () => {
    const query = db
      .select({ id: members.id })
      .from(members)
      .orderBy(...buildMembersOrderBy("name-desc"))
      .toSQL();

    expect(query.sql).toContain(
      'order by lower(trim(("members"."first_name" || $1 || "members"."last_name"))) desc',
    );
    expect(query.sql).toContain('"members"."username" asc');
    expect(query.sql).toContain('"members"."id" asc');
  });
});
