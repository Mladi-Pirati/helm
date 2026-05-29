import { describe, expect, test } from "bun:test";

import {
  DEFAULT_MEMBERS_PAGE_SIZE,
  MAX_MEMBERS_PAGE_SIZE,
  buildMembersFilterHref,
  buildMembersQueryString,
  parseMembersFilters,
} from "@/lib/members";

describe("member list filters", () => {
  test("uses stable defaults for empty search params", () => {
    expect(parseMembersFilters({})).toEqual({
      page: 1,
      pageSize: DEFAULT_MEMBERS_PAGE_SIZE,
      q: "",
      roleId: "",
      status: "active",
    });
  });

  test("trims text filters and clamps invalid pagination", () => {
    expect(
      parseMembersFilters({
        page: "-8",
        pageSize: String(MAX_MEMBERS_PAGE_SIZE + 500),
        q: "  ana  ",
        roleId: " role-1 ",
        status: "disabled",
      }),
    ).toEqual({
      page: 1,
      pageSize: MAX_MEMBERS_PAGE_SIZE,
      q: "ana",
      roleId: "role-1",
      status: "disabled",
    });
  });

  test("drops defaults when building query strings", () => {
    expect(
      buildMembersQueryString({
        page: 1,
        pageSize: DEFAULT_MEMBERS_PAGE_SIZE,
        q: "",
        roleId: "",
        status: "active",
      }),
    ).toBe("");

    expect(
      buildMembersQueryString({
        page: 2,
        pageSize: 25,
        q: "ana",
        roleId: "role-1",
        status: "all",
      }),
    ).toBe("q=ana&status=all&roleId=role-1&page=2&pageSize=25");
  });

  test("builds filter hrefs by resetting pagination and preserving page size", () => {
    expect(
      buildMembersFilterHref(
        {
          page: 4,
          pageSize: 25,
          q: "ana",
          roleId: "role-1",
          status: "disabled",
        },
        {
          q: "",
          roleId: "",
          status: "active",
        },
      ),
    ).toBe("/admin/members?pageSize=25");
  });
});
