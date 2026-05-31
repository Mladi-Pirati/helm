"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { modules, permissions } from "@/db/schema";
import { hasPermission } from "@/lib/auth/permissions";
import {
  createPermissionSchema,
  type CreatePermissionInput,
  updatePermissionSchema,
  type UpdatePermissionInput,
} from "@/lib/validation/permissions";

type ActionSuccess = { ok: true; message?: string };
type ActionFailure<TField extends string = string> = {
  ok: false;
  message: string;
  fieldErrors?: Partial<Record<TField, string>>;
};

type PermissionMutationActionResult = ActionSuccess | ActionFailure;

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
  const allowed = await hasPermission("access-control.manage_permissions");
  if (!allowed) {
    return {
      ok: false as const,
      message: "You are not allowed to manage access control.",
    };
  }
  return { ok: true as const };
}

export async function createPermissionAction(
  values: CreatePermissionInput,
): Promise<PermissionMutationActionResult> {
  const access = await requireAccessControlPermission();
  if (!access.ok) return { ok: false, message: access.message };

  const parsed = createPermissionSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        moduleId: fieldErrors.moduleId?.[0],
        action: fieldErrors.action?.[0],
        description: fieldErrors.description?.[0],
      },
    };
  }

  const moduleRow = await db.query.modules.findFirst({
    where: eq(modules.id, parsed.data.moduleId),
    columns: { key: true },
  });
  if (!moduleRow) {
    return {
      ok: false,
      message: "Selected module could not be found.",
      fieldErrors: { moduleId: "Selected module could not be found." },
    };
  }

  const key = `${moduleRow.key}.${parsed.data.action}`;

  try {
    await db.insert(permissions).values({ ...parsed.data, key });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message: "That permission already exists for this module.",
        fieldErrors: {
          action: "That permission already exists for this module.",
        },
      };
    }
    throw error;
  }

  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Permission created successfully." };
}

export async function updatePermissionAction(
  permissionId: string,
  values: UpdatePermissionInput,
): Promise<PermissionMutationActionResult> {
  const access = await requireAccessControlPermission();
  if (!access.ok) return { ok: false, message: access.message };

  const permissionRow = await db.query.permissions.findFirst({
    where: eq(permissions.id, permissionId),
    columns: { id: true },
  });
  if (!permissionRow)
    return { ok: false, message: "That permission could not be found." };

  const parsed = updatePermissionSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: { description: fieldErrors.description?.[0] },
    };
  }

  await db
    .update(permissions)
    .set(parsed.data)
    .where(eq(permissions.id, permissionId));
  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Permission updated successfully." };
}

export async function deletePermissionAction(
  permissionId: string,
): Promise<PermissionMutationActionResult> {
  const access = await requireAccessControlPermission();
  if (!access.ok) return { ok: false, message: access.message };

  const permissionRow = await db.query.permissions.findFirst({
    where: eq(permissions.id, permissionId),
    columns: { id: true },
  });
  if (!permissionRow)
    return { ok: false, message: "That permission could not be found." };

  await db.delete(permissions).where(eq(permissions.id, permissionId));
  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Permission deleted successfully." };
}
