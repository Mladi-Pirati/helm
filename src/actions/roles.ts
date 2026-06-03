"use server";

import { revalidatePath } from "next/cache";
import { asc, eq, inArray, max } from "drizzle-orm";

import { permissions, rolePermissions, roles } from "@/db/schema";
import {
  db,
  getCurrentUserHighestRoleRank,
  hasPermission,
} from "@/lib/roles-action-dependencies";
import {
  createRoleSchema,
  type CreateRoleInput,
  reorderRolesSchema,
  updateRoleSchema,
  type UpdateRoleInput,
} from "@/lib/validation/roles";

type ActionSuccess = { ok: true; message?: string };
type ActionFailure<TField extends string = string> = {
  ok: false;
  message: string;
  fieldErrors?: Partial<Record<TField, string>>;
};

type RoleMutationActionResult = ActionSuccess | ActionFailure;

function isUniqueViolation(error: unknown) {
  let currentError: unknown = error;
  while (typeof currentError === "object" && currentError !== null) {
    if ("code" in currentError && currentError.code === "23505") return true;
    if (!("cause" in currentError)) return false;
    currentError = currentError.cause;
  }
  return false;
}

async function requireAccessControlPermission() {
  const allowed = await hasPermission("access-control.manage_roles");
  if (!allowed) {
    return {
      ok: false as const,
      message: "You are not allowed to manage access control.",
    };
  }
  return { ok: true as const };
}

export async function createRoleAction(
  values: CreateRoleInput,
): Promise<RoleMutationActionResult> {
  const access = await requireAccessControlPermission();
  if (!access.ok) return { ok: false, message: access.message };

  const parsed = createRoleSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        key: fieldErrors.key?.[0],
        name: fieldErrors.name?.[0],
        description: fieldErrors.description?.[0],
      },
    };
  }

  const [rankRow] = await db.select({ value: max(roles.rank) }).from(roles);
  const rank = (rankRow.value ?? 0) + 1;

  try {
    await db.insert(roles).values({ ...parsed.data, rank });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const message = "That role key is already taken.";
      return {
        ok: false,
        message,
        fieldErrors: {
          key: "That role key is already taken.",
        },
      };
    }
    throw error;
  }

  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Role created successfully." };
}

export async function updateRoleAction(
  roleId: string,
  values: UpdateRoleInput,
): Promise<RoleMutationActionResult> {
  const access = await requireAccessControlPermission();
  if (!access.ok) return { ok: false, message: access.message };

  const roleRow = await db.query.roles.findFirst({
    where: eq(roles.id, roleId),
    columns: { id: true },
  });
  if (!roleRow)
    return { ok: false, message: "That role could not be found." };

  const parsed = updateRoleSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        name: fieldErrors.name?.[0],
        description: fieldErrors.description?.[0],
      },
    };
  }

  try {
    await db.update(roles).set(parsed.data).where(eq(roles.id, roleId));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message: "That role could not be updated.",
      };
    }
    throw error;
  }

  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Role updated successfully." };
}

export async function reorderRolesAction(
  roleIds: Array<string>,
): Promise<RoleMutationActionResult> {
  const access = await requireAccessControlPermission();
  if (!access.ok) return { ok: false, message: access.message };

  const parsed = reorderRolesSchema.safeParse({ roleIds });
  if (!parsed.success) return { ok: false, message: "Invalid role order." };

  const rows = await db
    .select({ id: roles.id, rank: roles.rank })
    .from(roles)
    .orderBy(asc(roles.rank));
  const existingIds = new Set(rows.map((row) => row.id));

  if (
    existingIds.size !== parsed.data.roleIds.length ||
    parsed.data.roleIds.some((id) => !existingIds.has(id))
  ) {
    return { ok: false, message: "Role order is out of date." };
  }

  const highestManagedRank = await getCurrentUserHighestRoleRank();
  if (highestManagedRank === null) {
    return {
      ok: false,
      message: "You cannot reorder roles without an active role.",
    };
  }

  const lockedIds = rows
    .filter((role) => role.rank <= highestManagedRank)
    .map((role) => role.id);
  const nextLockedIds = parsed.data.roleIds.slice(0, lockedIds.length);
  if (lockedIds.some((id, index) => nextLockedIds[index] !== id)) {
    return {
      ok: false,
      message: "You cannot move roles above your highest role.",
    };
  }

  await db.transaction(async (tx) => {
    for (const [index, roleId] of parsed.data.roleIds.entries()) {
      await tx
        .update(roles)
        .set({ rank: -1000 - index })
        .where(eq(roles.id, roleId));
    }
    for (const [index, roleId] of parsed.data.roleIds.entries()) {
      await tx
        .update(roles)
        .set({ rank: index + 1 })
        .where(eq(roles.id, roleId));
    }
  });

  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Role order saved." };
}

export async function deleteRoleAction(
  roleId: string,
): Promise<RoleMutationActionResult> {
  const access = await requireAccessControlPermission();
  if (!access.ok) return { ok: false, message: access.message };

  const roleRow = await db.query.roles.findFirst({
    where: eq(roles.id, roleId),
    columns: { id: true, isSystem: true },
  });
  if (!roleRow)
    return { ok: false, message: "That role could not be found." };
  if (roleRow.isSystem) {
    return { ok: false, message: "System roles cannot be deleted." };
  }

  await db.delete(roles).where(eq(roles.id, roleId));
  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Role deleted successfully." };
}

export async function updateRolePermissionsAction(
  roleId: string,
  permissionIds: Array<string>,
): Promise<RoleMutationActionResult> {
  const access = await requireAccessControlPermission();
  if (!access.ok) return { ok: false, message: access.message };

  const roleRow = await db.query.roles.findFirst({
    where: eq(roles.id, roleId),
    columns: { id: true },
  });
  if (!roleRow)
    return { ok: false, message: "That role could not be found." };

  // Validate permission IDs exist
  if (permissionIds.length > 0) {
    const existingPermissions = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(inArray(permissions.id, permissionIds));

    if (existingPermissions.length !== permissionIds.length) {
      return {
        ok: false,
        message: "One or more permissions could not be found.",
      };
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (permissionIds.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(
          permissionIds.map((permissionId) => ({ roleId, permissionId })),
        );
    }
  });

  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Role permissions updated successfully." };
}
