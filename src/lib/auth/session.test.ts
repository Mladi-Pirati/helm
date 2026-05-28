import { describe, expect, test } from "bun:test";

import { isAppSessionUser } from "@/lib/auth/session";

describe("isAppSessionUser", () => {
  test("rejects incomplete default session users", () => {
    expect(
      isAppSessionUser({
        name: "Ana Novak",
      }),
    ).toBe(false);
  });

  test("accepts complete Keycloak-backed app session users", () => {
    expect(
      isAppSessionUser({
        forcePasswordChange: false,
        fullName: "Ana Novak",
        id: "local-user-id",
        keycloakUserId: "keycloak-user-id",
        role: "admin",
        username: "ana",
      }),
    ).toBe(true);
  });
});
