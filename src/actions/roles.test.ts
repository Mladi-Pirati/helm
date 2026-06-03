import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

let allowed = true;
let currentUser: { keycloakUserId: string } | null = {
  keycloakUserId: "keycloak-current",
};
let currentMemberId: string | null = "current-member";
let maxRoleRank: number | null = null;
let currentUserRoleRanks: Array<number> = [2];
let roleRows: Array<{ id: string; rank: number }> = [];
let insertedRoles: Array<Record<string, unknown>> = [];
let updatedRoleValues: Array<Record<string, unknown>> = [];
let revalidatedPaths: Array<string> = [];

function hasPermission(permissionKey: string) {
  expect(permissionKey).toBe("access-control.manage_roles");
  return Promise.resolve(allowed);
}

function getCurrentUserHighestRoleRank() {
  if (!currentUser || !currentMemberId || !currentUserRoleRanks.length) {
    return Promise.resolve(null);
  }

  return Promise.resolve(Math.min(...currentUserRoleRanks));
}

function revalidatePath(path: string) {
  revalidatedPaths.push(path);
}

type MockDb = {
  delete(): { where(): void };
  insert(): { values(values: Record<string, unknown>): void };
  query: {
    members: { findFirst(): Promise<{ id: string } | null> };
    roles: { findFirst(): Promise<{ id: string; isSystem: boolean }> };
  };
  select(selection: Record<string, unknown>): {
    from(): Promise<Array<{ value: number | null }>> | {
      innerJoin(): {
        where(): Promise<Array<{ rank: number }>>;
      };
      orderBy(): Promise<Array<{ id: string; rank: number }>>;
      where(): Promise<Array<{ id: string; rank: number }>>;
    };
  };
  transaction<T>(callback: (tx: MockDb) => Promise<T>): Promise<T>;
  update(): {
    set(values: Record<string, unknown>): { where(): void };
  };
};

const db: MockDb = {
  query: {
    members: {
      async findFirst() {
        return currentMemberId ? { id: currentMemberId } : null;
      },
    },
    roles: {
      async findFirst() {
        return { id: "role-1", isSystem: false };
      },
    },
  },
  insert() {
    return {
      values(values: Record<string, unknown>) {
        insertedRoles.push(values);
      },
    };
  },
  select(selection: Record<string, unknown>) {
    const keys = Object.keys(selection);
    return {
      from() {
        if (keys.includes("value")) {
          return Promise.resolve([{ value: maxRoleRank }]);
        }

        return {
          orderBy() {
            return Promise.resolve(roleRows);
          },
          innerJoin() {
            return {
              where() {
                return Promise.resolve(
                  currentUserRoleRanks.map((rank) => ({ rank })),
                );
              },
            };
          },
          where() {
            return Promise.resolve(roleRows);
          },
        };
      },
    };
  },
  transaction<T>(callback: (tx: typeof db) => Promise<T>) {
    return callback(db);
  },
  update() {
    return {
      set(values: Record<string, unknown>) {
        updatedRoleValues.push(values);
        return {
          where() {
            return;
          },
        };
      },
    };
  },
  delete() {
    return {
      where() {
        return;
      },
    };
  },
};

mock.module("next/cache", () => ({ revalidatePath }));
mock.module("@/lib/roles-action-dependencies", () => ({
  db,
  getCurrentUserHighestRoleRank,
  hasPermission,
}));

const rolesActionsPromise = import("./roles");

afterAll(() => {
  mock.restore();
});

beforeEach(() => {
  allowed = true;
  currentUser = { keycloakUserId: "keycloak-current" };
  currentMemberId = "current-member";
  maxRoleRank = null;
  currentUserRoleRanks = [2];
  roleRows = [
    { id: "superadmin", rank: 1 },
    { id: "admin", rank: 2 },
    { id: "member", rank: 3 },
    { id: "guest", rank: 4 },
  ];
  insertedRoles = [];
  updatedRoleValues = [];
  revalidatedPaths = [];
});

describe("createRoleAction", () => {
  test("assigns rank 1 when no roles exist", async () => {
    const { createRoleAction } = await rolesActionsPromise;

    await expect(
      createRoleAction({
        description: "",
        key: "member",
        name: "Member",
      }),
    ).resolves.toEqual({ ok: true, message: "Role created successfully." });

    expect(insertedRoles[0]).toMatchObject({ key: "member", rank: 1 });
  });

  test("assigns one rank below the current lowest priority role", async () => {
    const { createRoleAction } = await rolesActionsPromise;
    maxRoleRank = 7;

    await createRoleAction({
      description: "",
      key: "helper",
      name: "Helper",
    });

    expect(insertedRoles[0]).toMatchObject({ key: "helper", rank: 8 });
  });
});

describe("reorderRolesAction", () => {
  test("saves reordered roles below the user's highest active role", async () => {
    const { reorderRolesAction } = await rolesActionsPromise;

    await expect(
      reorderRolesAction(["superadmin", "admin", "guest", "member"]),
    ).resolves.toEqual({ ok: true, message: "Role order saved." });

    expect(updatedRoleValues.map((value) => value.rank)).toEqual([
      -1000,
      -1001,
      -1002,
      -1003,
      1,
      2,
      3,
      4,
    ]);
    expect(revalidatedPaths).toEqual(["/admin/settings/roles"]);
  });

  test("rejects moving a role above the user's highest active role", async () => {
    const { reorderRolesAction } = await rolesActionsPromise;

    await expect(
      reorderRolesAction(["superadmin", "member", "admin", "guest"]),
    ).resolves.toEqual({
      ok: false,
      message: "You cannot move roles above your highest role.",
    });

    expect(updatedRoleValues).toEqual([]);
  });

  test("rejects stale role order submissions", async () => {
    const { reorderRolesAction } = await rolesActionsPromise;

    await expect(
      reorderRolesAction(["superadmin", "admin", "member"]),
    ).resolves.toEqual({ ok: false, message: "Role order is out of date." });

    expect(updatedRoleValues).toEqual([]);
  });

  test("enforces access-control permission", async () => {
    const { reorderRolesAction } = await rolesActionsPromise;
    allowed = false;

    await expect(
      reorderRolesAction(["superadmin", "admin", "guest", "member"]),
    ).resolves.toEqual({
      ok: false,
      message: "You are not allowed to manage access control.",
    });

    expect(updatedRoleValues).toEqual([]);
  });
});
