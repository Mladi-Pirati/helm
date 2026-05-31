"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { modules } from "@/db/schema";
import { hasPermission } from "@/lib/auth/permissions";
import {
  createModuleSchema,
  type CreateModuleInput,
  updateModuleSchema,
  type UpdateModuleInput,
} from "@/lib/validation/modules";

type ActionSuccess = { ok: true; message?: string };
type ActionFailure<TField extends string = string> = {
  ok: false;
  message: string;
  fieldErrors?: Partial<Record<TField, string>>;
};

type ModuleMutationActionResult = ActionSuccess | ActionFailure;

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
  const allowed = await hasPermission("access-control.manage_modules");
  if (!allowed) {
    return {
      ok: false as const,
      message: "You are not allowed to manage access control.",
    };
  }
  return { ok: true as const };
}

export async function createModuleAction(
  values: CreateModuleInput,
): Promise<ModuleMutationActionResult> {
  const access = await requireAccessControlPermission();
  if (!access.ok) return { ok: false, message: access.message };

  const parsed = createModuleSchema.safeParse(values);
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

  try {
    await db.insert(modules).values(parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message: "That module key is already taken.",
        fieldErrors: { key: "That module key is already taken." },
      };
    }
    throw error;
  }

  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Module created successfully." };
}

export async function updateModuleAction(
  moduleId: string,
  values: UpdateModuleInput,
): Promise<ModuleMutationActionResult> {
  const access = await requireAccessControlPermission();
  if (!access.ok) return { ok: false, message: access.message };

  const moduleRow = await db.query.modules.findFirst({
    where: eq(modules.id, moduleId),
    columns: { id: true },
  });
  if (!moduleRow)
    return { ok: false, message: "That module could not be found." };

  const parsed = updateModuleSchema.safeParse(values);
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

  await db.update(modules).set(parsed.data).where(eq(modules.id, moduleId));
  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Module updated successfully." };
}

export async function deleteModuleAction(
  moduleId: string,
): Promise<ModuleMutationActionResult> {
  const access = await requireAccessControlPermission();
  if (!access.ok) return { ok: false, message: access.message };

  const moduleRow = await db.query.modules.findFirst({
    where: eq(modules.id, moduleId),
    columns: { id: true },
  });
  if (!moduleRow)
    return { ok: false, message: "That module could not be found." };

  await db.delete(modules).where(eq(modules.id, moduleId));
  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Module deleted successfully." };
}
