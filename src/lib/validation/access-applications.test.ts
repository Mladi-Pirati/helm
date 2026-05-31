import { describe, expect, test } from "bun:test";

import { createAccessApplicationSchema } from "@/lib/validation/access-applications";

describe("access application validation", () => {
  test("requires a name, Keycloak client id, and client role", () => {
    const parsed = createAccessApplicationSchema.safeParse({
      description: "",
      keycloakClientId: "",
      keycloakRoleName: "",
      name: "",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      expect(errors.name?.[0]).toBe("Name must be at least 2 characters long.");
      expect(errors.keycloakClientId?.[0]).toBe("Client id is required.");
      expect(errors.keycloakRoleName?.[0]).toBe("Client role is required.");
    }
  });

  test("trims optional description and Keycloak mapping values", () => {
    const parsed = createAccessApplicationSchema.parse({
      description: "  Forum access  ",
      keycloakClientId: " forum ",
      keycloakRoleName: " member ",
      name: " Forum ",
    });

    expect(parsed).toEqual({
      description: "Forum access",
      keycloakClientId: "forum",
      keycloakRoleName: "member",
      name: "Forum",
    });
  });
});
