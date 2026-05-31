import { describe, expect, test } from "bun:test";

import {
  getKeycloakUserDisplayName,
  keycloakProfileHasClientRole,
} from "@/lib/auth/keycloak-access";

describe("keycloakProfileHasClientRole", () => {
  test("accepts any role mapped to the configured client", () => {
    expect(
      keycloakProfileHasClientRole(
        {
          sub: "user-1",
          resource_access: {
            applications: {
              roles: ["user"],
            },
          },
        },
        "applications",
      ),
    ).toBe(true);
  });

  test("rejects users without roles for the configured client", () => {
    expect(
      keycloakProfileHasClientRole(
        {
          sub: "user-1",
          resource_access: {
            other: {
              roles: ["user"],
            },
          },
        },
        "applications",
      ),
    ).toBe(false);
  });
});

describe("getKeycloakUserDisplayName", () => {
  test("prefers Keycloak full name and falls back to username", () => {
    expect(
      getKeycloakUserDisplayName({
        firstName: "Ana",
        lastName: "Novak",
        username: "ana",
      }),
    ).toBe("Ana Novak");

    expect(
      getKeycloakUserDisplayName({
        username: "bojan",
      }),
    ).toBe("bojan");
  });
});
