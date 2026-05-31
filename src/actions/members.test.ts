import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

let allowed = true;
let currentMemberId: string | null = "current-member";
let currentUserHighestRoleRank: number | null = 1;
let highestRoleRank: number | null = 1;
let targetMember:
  | {
      disabledAt: Date | null;
      firstName: string;
      id: string;
      keycloakId: string;
      lastName: string;
      username: string;
    }
  | null = {
  disabledAt: null,
  firstName: "Ada",
  id: "target-member",
  keycloakId: "keycloak-target",
  lastName: "Lovelace",
  username: "ada",
};
let deletedMemberIds: string[] = [];
let deleteUserCalls: string[] = [];
let removeAllClientRolesCalls: string[] = [];
let syncMemberApplicationRolesCalls: Array<{
  disabled: boolean;
  keycloakId: string;
  memberId: string;
}> = [];
let revalidatedPaths: string[] = [];
let keycloakUsersById: Record<
  string,
  {
    email: string | null;
    emailVerified: boolean;
    enabled: boolean;
    firstName: string | null;
    fullName: string;
    id: string;
    lastName: string | null;
    username: string;
  }
> = {};
let keycloakUsersByEmail: Record<
  string,
  (typeof keycloakUsersById)[string]
> = {};
let keycloakUsersByUsername: Record<
  string,
  (typeof keycloakUsersById)[string]
> = {};
let createdKeycloakUsers: Array<{
  email: string;
  firstName: string;
  lastName: string;
  username: string;
}> = [];
let createdMembers: Array<{
  firstName: string;
  keycloakId: string;
  lastName: string;
  notes?: string;
  username: string;
}> = [];
let createdContacts: Array<{
  isPrimary: boolean;
  label: string;
  memberId: string;
  sortOrder: number;
  type: string;
  value: string;
}> = [];
let bulkResendRows: Array<{
  email: string | null;
  firstName: string;
  id: string;
  lastName: string;
}> = [];
let sentWelcomeEmails: Array<{
  email: string;
  firstName: string;
  idempotencyKey: string;
  memberId: string;
}> = [];
let failingWelcomeEmailAddresses = new Set<string>();
let failNextMemberInsertWithUniqueViolation = false;

function createMembersKeycloakAdminClient() {
  return {
    async createUser(values: {
      email: string;
      firstName: string;
      lastName: string;
      username: string;
    }) {
      createdKeycloakUsers.push(values);
      const user = {
        email: values.email,
        emailVerified: false,
        enabled: true,
        firstName: values.firstName,
        fullName: `${values.firstName} ${values.lastName}`.trim(),
        id: "created-keycloak-user",
        lastName: values.lastName,
        username: values.username,
      };
      keycloakUsersById[user.id] = user;
      return user;
    },
    async deleteUser(userId: string) {
      deleteUserCalls.push(userId);
    },
    async findUserByEmail(email: string) {
      return keycloakUsersByEmail[email.trim().toLowerCase()] ?? null;
    },
    async findUserByUsername(username: string) {
      return keycloakUsersByUsername[username.trim()] ?? null;
    },
    async getUser(userId: string) {
      const user = keycloakUsersById[userId];
      if (!user) throw new Error("Keycloak user not found");
      return user;
    },
    async removeAllClientRoles(userId: string) {
      removeAllClientRolesCalls.push(userId);
    },
  };
}

async function hasPermission(permissionKey: string) {
  expect(["members.create", "members.delete", "members.update"]).toContain(
    permissionKey,
  );
  return allowed;
}

async function getCurrentUser() {
  return currentMemberId
    ? { keycloakUserId: "current-keycloak-user" }
    : null;
}

async function getCurrentUserHighestRoleRank() {
  return currentUserHighestRoleRank;
}

async function getHighestRoleRank() {
  return highestRoleRank;
}

async function sendMembershipWelcomeEmail(input: {
  email: string;
  firstName: string;
  idempotencyKey: string;
  memberId: string;
}) {
  sentWelcomeEmails.push(input);
  return !failingWelcomeEmailAddresses.has(input.email);
}

async function syncMemberApplicationRoles(values: {
  disabled: boolean;
  keycloakId: string;
  memberId: string;
}) {
  syncMemberApplicationRolesCalls.push(values);
}

function revalidatePath(path: string) {
  revalidatedPaths.push(path);
}

type MockDb = {
  delete(table: unknown): { where(condition: unknown): void };
  insert(): {
    values(values: unknown):
      | { returning(): Promise<Array<{ id: string }>> }
      | undefined;
  };
  query: {
    contacts: { findFirst(): Promise<null> };
    members: {
      findFirst(options: { columns?: Record<string, true> }): Promise<
        | {
            disabledAt: Date | null;
            firstName: string;
            id: string;
            keycloakId: string;
            lastName: string;
            username: string;
          }
        | { id: string }
        | null
      >;
    };
  };
  select(): {
    from(table?: unknown): {
      leftJoin(): {
        where(): {
          orderBy(): Promise<typeof bulkResendRows>;
        };
      };
      where(condition?: unknown):
        | Promise<Array<{ value: null }>>
        | {
            orderBy(): Promise<typeof bulkResendRows>;
          };
    };
  };
  transaction<T>(callback: (tx: MockDb) => Promise<T>): Promise<T>;
  update(): {
    set(): {
      where(): void;
    };
  };
};

const db: MockDb = {
  async transaction<T>(callback: (tx: MockDb) => Promise<T>) {
    return callback(db);
  },
  query: {
    contacts: {
      async findFirst() {
        return null;
      },
    },
    members: {
      async findFirst(options: { columns?: Record<string, true> }) {
        if (options.columns?.keycloakId) return targetMember;
        return currentMemberId ? { id: currentMemberId } : null;
      },
    },
  },
  delete(table: unknown) {
    expect(table).toBeTruthy();
    return {
      where(condition: unknown) {
        deletedMemberIds.push(String(condition));
      },
    };
  },
  insert() {
    return {
      values(values: unknown) {
        if (Array.isArray(values)) {
          createdContacts.push(
            ...values.map((value) => ({
              ...(value as (typeof createdContacts)[number]),
            })),
          );
          return;
        }

        if (failNextMemberInsertWithUniqueViolation) {
          failNextMemberInsertWithUniqueViolation = false;
          throw Object.assign(new Error("duplicate key"), { code: "23505" });
        }

        const insertValue = values as Record<string, unknown>;
        if ("memberId" in insertValue && "type" in insertValue) {
          createdContacts.push({
            ...(insertValue as (typeof createdContacts)[number]),
          });
          return;
        }

        createdMembers.push({
          ...(values as (typeof createdMembers)[number]),
        });

        return {
          async returning() {
            return [{ id: `created-member-${createdMembers.length}` }];
          },
        };
      },
    };
  },
  select() {
    return {
      from() {
        return {
          leftJoin() {
            return {
              where() {
                return {
                  async orderBy() {
                    return bulkResendRows;
                  },
                };
              },
            };
          },
          where() {
            if (bulkResendRows.length) {
              return {
                async orderBy() {
                  return bulkResendRows;
                },
              };
            }

            return Promise.resolve([{ value: null }]);
          },
        };
      },
    };
  },
  update() {
    return {
      set() {
        return {
          where() {
            return;
          },
        };
      },
    };
  },
};

mock.module("next/cache", () => ({ revalidatePath }));
mock.module("@/lib/members-action-dependencies", () => ({
  createMembersKeycloakAdminClient,
  db,
  getCurrentUser,
  getCurrentUserHighestRoleRank,
  getHighestRoleRank,
  hasPermission,
  sendMembershipWelcomeEmail,
  syncMemberApplicationRoles,
}));

const membersActionsPromise = import("./members");

afterAll(() => {
  mock.restore();
});

beforeEach(() => {
  allowed = true;
  currentMemberId = "current-member";
  currentUserHighestRoleRank = 1;
  highestRoleRank = 1;
  targetMember = {
    disabledAt: null,
    firstName: "Ada",
    id: "target-member",
    keycloakId: "keycloak-target",
    lastName: "Lovelace",
    username: "ada",
  };
  deletedMemberIds = [];
  deleteUserCalls = [];
  removeAllClientRolesCalls = [];
  syncMemberApplicationRolesCalls = [];
  revalidatedPaths = [];
  keycloakUsersById = {
    "selected-keycloak-user": {
      email: "selected@example.test",
      emailVerified: true,
      enabled: true,
      firstName: "Selected",
      fullName: "Selected User",
      id: "selected-keycloak-user",
      lastName: "User",
      username: "selected",
    },
  };
  keycloakUsersByEmail = {};
  keycloakUsersByUsername = {};
  createdKeycloakUsers = [];
  createdMembers = [];
  createdContacts = [];
  bulkResendRows = [];
  sentWelcomeEmails = [];
  failingWelcomeEmailAddresses = new Set<string>();
  failNextMemberInsertWithUniqueViolation = false;
});

describe("createMemberAction", () => {
  test("creates a local member linked to a selected Keycloak user", async () => {
    const { createMemberAction } = await membersActionsPromise;

    await expect(
      createMemberAction({
        firstName: "Local",
        keycloakId: "selected-keycloak-user",
        lastName: "Override",
        notes: "Admin note",
        primaryEmail: "LOCAL@EXAMPLE.TEST",
        username: "local-selected",
      }),
    ).resolves.toEqual({
      ok: true,
      memberId: "created-member-1",
      message: "Member created successfully.",
    });
    expect(createdKeycloakUsers).toEqual([]);
    expect(createdMembers).toEqual([
      {
        firstName: "Local",
        keycloakId: "selected-keycloak-user",
        lastName: "Override",
        notes: "Admin note",
        username: "local-selected",
      },
    ]);
    expect(createdContacts).toMatchObject([
      {
        isPrimary: true,
        memberId: "created-member-1",
        sortOrder: 0,
        type: "email",
        value: "local@example.test",
      },
    ]);
  });

  test("pairs an existing Keycloak user found by primary email", async () => {
    const existingUser = {
      email: "ana@example.test",
      emailVerified: true,
      enabled: true,
      firstName: "Ana",
      fullName: "Ana Novak",
      id: "existing-keycloak-user",
      lastName: "Novak",
      username: "existing.ana",
    };
    keycloakUsersByEmail[existingUser.email] = existingUser;
    const { createMemberAction } = await membersActionsPromise;

    await expect(
      createMemberAction({
        firstName: "Ana",
        keycloakId: "",
        lastName: "Novak",
        notes: "",
        primaryEmail: "ANA@EXAMPLE.TEST",
        username: "requested-ana",
      }),
    ).resolves.toMatchObject({
      ok: true,
      memberId: "created-member-1",
    });
    expect(createdKeycloakUsers).toEqual([]);
    expect(createdMembers[0]).toMatchObject({
      firstName: "Ana",
      keycloakId: "existing-keycloak-user",
      lastName: "Novak",
      username: "existing.ana",
    });
  });

  test("creates a Keycloak user when email and username are unused", async () => {
    const { createMemberAction } = await membersActionsPromise;

    await expect(
      createMemberAction({
        firstName: "Ana",
        keycloakId: "",
        lastName: "Novak",
        notes: "",
        primaryEmail: "ANA@EXAMPLE.TEST",
        username: "ana.novak",
      }),
    ).resolves.toMatchObject({
      ok: true,
      memberId: "created-member-1",
    });
    expect(createdKeycloakUsers).toEqual([
      {
        email: "ana@example.test",
        firstName: "Ana",
        lastName: "Novak",
        username: "ana.novak",
      },
    ]);
    expect(createdMembers[0]).toMatchObject({
      keycloakId: "created-keycloak-user",
      username: "ana.novak",
    });
  });

  test("returns a username error when creating a new Keycloak user and username is taken", async () => {
    keycloakUsersByUsername["ana.novak"] = {
      email: "other@example.test",
      emailVerified: true,
      enabled: true,
      firstName: "Other",
      fullName: "Other User",
      id: "other-keycloak-user",
      lastName: "User",
      username: "ana.novak",
    };
    const { createMemberAction } = await membersActionsPromise;

    await expect(
      createMemberAction({
        firstName: "Ana",
        keycloakId: "",
        lastName: "Novak",
        notes: "",
        primaryEmail: "ana@example.test",
        username: "ana.novak",
      }),
    ).resolves.toEqual({
      ok: false,
      message: "That username is already taken in Keycloak.",
      fieldErrors: {
        username: "That username is already taken in Keycloak.",
      },
    });
    expect(createdKeycloakUsers).toEqual([]);
    expect(createdMembers).toEqual([]);
  });

  test("returns the existing duplicate-link error for an already linked Keycloak user", async () => {
    failNextMemberInsertWithUniqueViolation = true;
    const { createMemberAction } = await membersActionsPromise;

    await expect(
      createMemberAction({
        firstName: "Selected",
        keycloakId: "selected-keycloak-user",
        lastName: "User",
        notes: "",
        primaryEmail: "selected@example.test",
        username: "selected",
      }),
    ).resolves.toEqual({
      ok: false,
      message: "That Keycloak user is already linked to a member.",
      fieldErrors: {
        keycloakId: "That Keycloak user is already linked to a member.",
      },
    });
  });
});

describe("deleteMemberAction", () => {
  test("rejects users without members.delete permission", async () => {
    allowed = false;
    const { deleteMemberAction } = await membersActionsPromise;

    await expect(deleteMemberAction("target-member", "local")).resolves.toEqual(
      {
        ok: false,
        message: "You are not allowed to manage members.",
      },
    );
    expect(deletedMemberIds).toEqual([]);
  });

  test("rejects self-deletion", async () => {
    currentMemberId = "target-member";
    const { deleteMemberAction } = await membersActionsPromise;

    await expect(deleteMemberAction("target-member", "local")).resolves.toEqual(
      {
        ok: false,
        message: "You cannot delete your own member account.",
      },
    );
    expect(deletedMemberIds).toEqual([]);
  });

  test("deletes only the local member for local mode", async () => {
    const { deleteMemberAction } = await membersActionsPromise;

    await expect(deleteMemberAction("target-member", "local")).resolves.toEqual(
      {
        ok: true,
        message: "Member deleted.",
      },
    );
    expect(deleteUserCalls).toEqual([]);
    expect(removeAllClientRolesCalls).toEqual([]);
    expect(syncMemberApplicationRolesCalls).toEqual([]);
    expect(deletedMemberIds).toHaveLength(1);
    expect(revalidatedPaths).toEqual([
      "/admin/members",
      "/admin/members/target-member",
    ]);
  });

  test("deletes the Keycloak user before deleting the local member", async () => {
    const { deleteMemberAction } = await membersActionsPromise;

    await expect(
      deleteMemberAction("target-member", "local-and-keycloak"),
    ).resolves.toEqual({
      ok: true,
      message: "Member deleted.",
    });
    expect(deleteUserCalls).toEqual(["keycloak-target"]);
    expect(deletedMemberIds).toHaveLength(1);
  });

  test("revokes Helm-managed roles before deleting the local member", async () => {
    const { deleteMemberAction } = await membersActionsPromise;

    await expect(
      deleteMemberAction("target-member", "local-and-revoke-helm"),
    ).resolves.toEqual({
      ok: true,
      message: "Member deleted.",
    });
    expect(removeAllClientRolesCalls).toEqual(["keycloak-target"]);
    expect(syncMemberApplicationRolesCalls).toEqual([
      {
        disabled: true,
        keycloakId: "keycloak-target",
        memberId: "target-member",
      },
    ]);
    expect(deletedMemberIds).toHaveLength(1);
  });
});

describe("bulkResendWelcomeEmailAction", () => {
  test("rejects users without member update permission", async () => {
    allowed = false;
    const { bulkResendWelcomeEmailAction } = await membersActionsPromise;

    await expect(
      bulkResendWelcomeEmailAction({ memberIds: ["member-1"] }),
    ).resolves.toEqual({
      ok: false,
      message: "You are not allowed to manage members.",
    });
    expect(sentWelcomeEmails).toEqual([]);
  });

  test("rejects users without the globally highest-ranked role", async () => {
    currentUserHighestRoleRank = 2;
    highestRoleRank = 1;
    const { bulkResendWelcomeEmailAction } = await membersActionsPromise;

    await expect(
      bulkResendWelcomeEmailAction({ memberIds: ["member-1"] }),
    ).resolves.toEqual({
      ok: false,
      message: "Only members with the highest-ranked role can resend welcome emails.",
    });
    expect(sentWelcomeEmails).toEqual([]);
  });

  test("sends one welcome email per selected member with a single recipient", async () => {
    bulkResendRows = [
      {
        email: "ana@example.test",
        firstName: "Ana",
        id: "member-1",
        lastName: "Novak",
      },
      {
        email: "bine@example.test",
        firstName: "Bine",
        id: "member-2",
        lastName: "Kranjc",
      },
    ];
    const { bulkResendWelcomeEmailAction } = await membersActionsPromise;

    await expect(
      bulkResendWelcomeEmailAction({
        memberIds: ["member-1", "member-2", "member-1"],
      }),
    ).resolves.toMatchObject({
      ok: true,
      affectedCount: 2,
      failedCount: 0,
      notFoundCount: 0,
      sentCount: 2,
      skippedMissingEmailCount: 0,
    });
    expect(sentWelcomeEmails).toHaveLength(2);
    expect(sentWelcomeEmails.map((email) => email.email)).toEqual([
      "ana@example.test",
      "bine@example.test",
    ]);
    expect(
      sentWelcomeEmails.every((email) => typeof email.email === "string"),
    ).toBe(true);
    expect(
      sentWelcomeEmails.every((email) =>
        email.idempotencyKey.startsWith(
          `membership-welcome-resend/${email.memberId}/`,
        ),
      ),
    ).toBe(true);
    expect(
      sentWelcomeEmails.some((email) =>
        email.idempotencyKey.startsWith("membership-approval/"),
      ),
    ).toBe(false);
  });

  test("reports skipped missing emails, not-found members, and partial failures", async () => {
    bulkResendRows = [
      {
        email: "ana@example.test",
        firstName: "Ana",
        id: "member-1",
        lastName: "Novak",
      },
      {
        email: null,
        firstName: "Bine",
        id: "member-2",
        lastName: "Kranjc",
      },
      {
        email: "cilka@example.test",
        firstName: "Cilka",
        id: "member-3",
        lastName: "Kos",
      },
    ];
    failingWelcomeEmailAddresses.add("cilka@example.test");
    const { bulkResendWelcomeEmailAction } = await membersActionsPromise;

    await expect(
      bulkResendWelcomeEmailAction({
        memberIds: ["member-1", "member-2", "member-3", "missing-member"],
      }),
    ).resolves.toEqual({
      ok: true,
      affectedCount: 3,
      failedCount: 1,
      message:
        "Sent 1 welcome email. 1 failed, 1 skipped without a primary email, and 1 selected member was not found.",
      notFoundCount: 1,
      sentCount: 1,
      skippedMissingEmailCount: 1,
    });
    expect(sentWelcomeEmails.map((email) => email.email)).toEqual([
      "ana@example.test",
      "cilka@example.test",
    ]);
  });
});
