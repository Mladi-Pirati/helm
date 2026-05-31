import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

let allowed = true;
let currentMemberId: string | null = "current-member";
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

function createMembersKeycloakAdminClient() {
  return {
    async deleteUser(userId: string) {
      deleteUserCalls.push(userId);
    },
    async removeAllClientRoles(userId: string) {
      removeAllClientRolesCalls.push(userId);
    },
  };
}

async function hasPermission(permissionKey: string) {
  expect(permissionKey).toBe("members.delete");
  return allowed;
}

async function getCurrentUser() {
  return currentMemberId
    ? { keycloakUserId: "current-keycloak-user" }
    : null;
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

const db = {
  query: {
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
    throw new Error("insert should not be called");
  },
  select() {
    throw new Error("select should not be called");
  },
  update() {
    throw new Error("update should not be called");
  },
};

mock.module("next/cache", () => ({ revalidatePath }));
mock.module("@/lib/members-action-dependencies", () => ({
  createMembersKeycloakAdminClient,
  db,
  getCurrentUser,
  hasPermission,
  syncMemberApplicationRoles,
}));

const membersActionsPromise = import("./members");

afterAll(() => {
  mock.restore();
});

beforeEach(() => {
  allowed = true;
  currentMemberId = "current-member";
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
