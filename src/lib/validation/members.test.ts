import { describe, expect, test } from "bun:test";

import {
  addressInputSchema,
  contactInputSchema,
  createMemberSchema,
  memberProfileSchema,
  membershipRenewalSchema,
  roleAssignmentSchema,
} from "@/lib/validation/members";

describe("member validation", () => {
  test("normalizes create-member input from a Keycloak user", () => {
    expect(
      createMemberSchema.parse({
        firstName: " Ana ",
        keycloakId: " keycloak-1 ",
        lastName: " Novak ",
        primaryEmail: " ANA@EXAMPLE.TEST ",
        username: " ana ",
      }),
    ).toEqual({
      firstName: "Ana",
      keycloakId: "keycloak-1",
      lastName: "Novak",
      notes: "",
      primaryEmail: "ana@example.test",
      username: "ana",
    });
  });

  test("normalizes create-member input without a selected Keycloak user", () => {
    expect(
      createMemberSchema.parse({
        firstName: " Ana ",
        lastName: " Novak ",
        primaryEmail: " ANA@EXAMPLE.TEST ",
        username: " ana ",
      }),
    ).toEqual({
      firstName: "Ana",
      keycloakId: "",
      lastName: "Novak",
      notes: "",
      primaryEmail: "ana@example.test",
      username: "ana",
    });
  });

  test("requires primary email when creating without a selected Keycloak user", () => {
    const result = createMemberSchema.safeParse({
      firstName: "Ana",
      keycloakId: "",
      lastName: "Novak",
      primaryEmail: "",
      username: "ana",
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.primaryEmail?.[0]).toBe(
      "Enter a valid email address.",
    );
  });

  test("validates role assignments by role id only", () => {
    expect(
      roleAssignmentSchema.parse({
        roleId: " role-1 ",
      }),
    ).toEqual({
      roleId: "role-1",
    });

    expect(
      roleAssignmentSchema.safeParse({
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        roleId: "role-1",
      }).success,
    ).toBe(false);
  });

  test("validates contact, address, profile, and renewal payloads", () => {
    expect(
      contactInputSchema.safeParse({
        isPrimary: true,
        label: "Personal",
        type: "email",
        value: "ANA@EXAMPLE.TEST",
      }),
    ).toMatchObject({
      data: {
        value: "ana@example.test",
      },
      success: true,
    });

    expect(
      addressInputSchema.safeParse({
        city: "Ljubljana",
        country: "Slovenia",
        label: "primary",
        postalCode: "1000",
        street: "Trg 1",
      }).success,
    ).toBe(true);

    expect(
      memberProfileSchema.safeParse({
        firstName: "Ana",
        lastName: "Novak",
        notes: "",
        primaryEmail: "ana@example.test",
        username: "ana",
      }).success,
    ).toBe(true);

    expect(
      membershipRenewalSchema.safeParse({
        expiresAt: "2027-01-01",
        extendedAt: "2026-01-01",
      }).success,
    ).toBe(true);
  });

  test("allows indefinite memberships and ended memberships", () => {
    expect(
      membershipRenewalSchema.parse({
        endedAt: "",
        expiresAt: "",
        extendedAt: "2026-01-01",
      }),
    ).toEqual({
      endedAt: "",
      expiresAt: "",
      extendedAt: "2026-01-01",
    });

    expect(
      membershipRenewalSchema.safeParse({
        endedAt: "2026-02-01",
        expiresAt: "",
        extendedAt: "2026-01-01",
      }).success,
    ).toBe(true);
  });
});
