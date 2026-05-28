# Role & Permission Management Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/admin/users` with a full CRUD Role & Permission Management panel at `/admin/settings/roles` with tabs for Modules, Permissions, and Roles.

**Architecture:** Server components fetch data via Drizzle and pass serialized data to client components. Client components use React Hook Form + Zod for validation, Sheet for create/edit forms, AlertDialog for deletions, and Tabs for navigation between sections. Server Actions handle mutations with admin access checks.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Drizzle ORM, shadcn/ui, Zod, React Hook Form, @tanstack/react-table, date-fns, lucide-react

---

## File Structure

### New Files
- `src/lib/validation/modules.ts` — Zod schemas for modules
- `src/lib/validation/permissions.ts` — Zod schemas for permissions
- `src/lib/validation/roles.ts` — Zod schemas for roles
- `src/actions/modules.ts` — Server actions for modules CRUD
- `src/actions/permissions.ts` — Server actions for permissions CRUD
- `src/actions/roles.ts` — Server actions for roles CRUD + role permissions
- `src/components/admin/roles/form-sheet.tsx` — Shared form sheet component (pattern from newsletter-form-sheet)
- `src/components/admin/roles/modules-management.tsx` — Module list + CRUD
- `src/components/admin/roles/permissions-management.tsx` — Permission list + CRUD
- `src/components/admin/roles/roles-management.tsx` — Role list + CRUD
- `src/components/admin/roles/role-permissions-sheet.tsx` — Sheet to manage permissions for a role
- `src/components/admin/roles/add-module-sheet.tsx` — Create module form sheet
- `src/components/admin/roles/edit-module-sheet.tsx` — Edit module form sheet
- `src/components/admin/roles/delete-module-dialog.tsx` — Delete module alert dialog
- `src/components/admin/roles/add-permission-sheet.tsx` — Create permission form sheet
- `src/components/admin/roles/edit-permission-sheet.tsx` — Edit permission form sheet
- `src/components/admin/roles/delete-permission-dialog.tsx` — Delete permission alert dialog
- `src/components/admin/roles/add-role-sheet.tsx` — Create role form sheet
- `src/components/admin/roles/edit-role-sheet.tsx` — Edit role form sheet
- `src/components/admin/roles/delete-role-dialog.tsx` — Delete role alert dialog
- `src/app/admin/settings/roles/page.tsx` — Server component page

### Modified Files
- `src/components/admin/admin-nav-links.tsx` — Replace "Users" nav item with "Access Control"
- `src/app/admin/users/page.tsx` — Delete or repurpose (remove)

---

## Task 1: Install Missing shadcn Components

**Files:**
- Modify: `package.json` (indirectly via shadcn CLI)

- [ ] **Step 1: Install tabs, checkbox, and tooltip components**

Run: `bunx --bun shadcn@latest add tabs checkbox tooltip`
Expected: Components installed to `src/components/ui/`

---

## Task 2: Update Admin Navigation

**Files:**
- Modify: `src/components/admin/admin-nav-links.tsx`

- [ ] **Step 1: Replace Users nav item**

Change the conditional `isAdmin` nav item from:
```tsx
{
  href: "/admin/users",
  label: "Users",
  icon: Users2Icon,
  active: pathname.startsWith("/admin/users"),
}
```

To:
```tsx
{
  href: "/admin/settings/roles",
  label: "Access Control",
  icon: ShieldIcon,
  active: pathname.startsWith("/admin/settings/roles"),
}
```

Add `ShieldIcon` import from `lucide-react`.

---

## Task 3: Create Validation Schemas

**Files:**
- Create: `src/lib/validation/modules.ts`
- Create: `src/lib/validation/permissions.ts`
- Create: `src/lib/validation/roles.ts`

- [ ] **Step 1: Write module validation schema**

```ts
import { z } from "zod";

export const moduleKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Key must be at least 2 characters long.")
  .max(80, "Key must be 80 characters or fewer.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens only.",
  );

const moduleDetailsSchema = {
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long.")
    .max(120, "Name must be 120 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer.")
    .optional()
    .or(z.literal("")),
};

export const createModuleSchema = z.object({
  ...moduleDetailsSchema,
  key: moduleKeySchema,
});

export const updateModuleSchema = z.object(moduleDetailsSchema);

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
```

- [ ] **Step 2: Write permission validation schema**

```ts
import { z } from "zod";

export const permissionActionSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Action must be at least 2 characters long.")
  .max(80, "Action must be 80 characters or fewer.")
  .regex(/^[a-z_]+$/, "Use lowercase letters and underscores only.");

const permissionDetailsSchema = {
  moduleId: z.string().uuid("Please select a module."),
  action: permissionActionSchema,
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer.")
    .optional()
    .or(z.literal("")),
};

export const createPermissionSchema = z.object(permissionDetailsSchema);

export const updatePermissionSchema = z.object({
  description: permissionDetailsSchema.description,
});

export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
```

- [ ] **Step 3: Write role validation schema**

```ts
import { z } from "zod";

export const roleKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Key must be at least 2 characters long.")
  .max(80, "Key must be 80 characters or fewer.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens only.",
  );

const roleDetailsSchema = {
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long.")
    .max(120, "Name must be 120 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer.")
    .optional()
    .or(z.literal("")),
  rank: z.coerce
    .number()
    .int("Rank must be a whole number.")
    .positive("Rank must be a positive number."),
};

export const createRoleSchema = z.object({
  ...roleDetailsSchema,
  key: roleKeySchema,
});

export const updateRoleSchema = z.object(roleDetailsSchema);

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
```

---

## Task 4: Create Server Actions — Modules

**Files:**
- Create: `src/actions/modules.ts`

- [ ] **Step 1: Write modules server actions**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { modules } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
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

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { ok: false as const, message: "You are not allowed to manage access control." };
  }
  return { ok: true as const, user };
}

export async function createModuleAction(
  values: CreateModuleInput,
): Promise<ModuleMutationActionResult> {
  const access = await requireAdmin();
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
  const access = await requireAdmin();
  if (!access.ok) return { ok: false, message: access.message };

  const moduleRow = await db.query.modules.findFirst({
    where: eq(modules.id, moduleId),
    columns: { id: true },
  });
  if (!moduleRow) return { ok: false, message: "That module could not be found." };

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
  const access = await requireAdmin();
  if (!access.ok) return { ok: false, message: access.message };

  const moduleRow = await db.query.modules.findFirst({
    where: eq(modules.id, moduleId),
    columns: { id: true },
  });
  if (!moduleRow) return { ok: false, message: "That module could not be found." };

  await db.delete(modules).where(eq(modules.id, moduleId));
  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Module deleted successfully." };
}
```

---

## Task 5: Create Server Actions — Permissions

**Files:**
- Create: `src/actions/permissions.ts`

- [ ] **Step 1: Write permissions server actions**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { modules, permissions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
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

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { ok: false as const, message: "You are not allowed to manage access control." };
  }
  return { ok: true as const, user };
}

export async function createPermissionAction(
  values: CreatePermissionInput,
): Promise<PermissionMutationActionResult> {
  const access = await requireAdmin();
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
        fieldErrors: { action: "That permission already exists for this module." },
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
  const access = await requireAdmin();
  if (!access.ok) return { ok: false, message: access.message };

  const permissionRow = await db.query.permissions.findFirst({
    where: eq(permissions.id, permissionId),
    columns: { id: true },
  });
  if (!permissionRow) return { ok: false, message: "That permission could not be found." };

  const parsed = updatePermissionSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: { description: fieldErrors.description?.[0] },
    };
  }

  await db.update(permissions).set(parsed.data).where(eq(permissions.id, permissionId));
  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Permission updated successfully." };
}

export async function deletePermissionAction(
  permissionId: string,
): Promise<PermissionMutationActionResult> {
  const access = await requireAdmin();
  if (!access.ok) return { ok: false, message: access.message };

  const permissionRow = await db.query.permissions.findFirst({
    where: eq(permissions.id, permissionId),
    columns: { id: true },
  });
  if (!permissionRow) return { ok: false, message: "That permission could not be found." };

  await db.delete(permissions).where(eq(permissions.id, permissionId));
  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Permission deleted successfully." };
}
```

---

## Task 6: Create Server Actions — Roles + Role Permissions

**Files:**
- Create: `src/actions/roles.ts`

- [ ] **Step 1: Write roles server actions**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { permissions, rolePermissions, roles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createRoleSchema,
  type CreateRoleInput,
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

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { ok: false as const, message: "You are not allowed to manage access control." };
  }
  return { ok: true as const, user };
}

export async function createRoleAction(
  values: CreateRoleInput,
): Promise<RoleMutationActionResult> {
  const access = await requireAdmin();
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
        rank: fieldErrors.rank?.[0],
      },
    };
  }

  try {
    await db.insert(roles).values(parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const message = "That role key or rank is already taken.";
      return {
        ok: false,
        message,
        fieldErrors: {
          key: "That role key is already taken.",
          rank: "That rank is already taken.",
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
  const access = await requireAdmin();
  if (!access.ok) return { ok: false, message: access.message };

  const roleRow = await db.query.roles.findFirst({
    where: eq(roles.id, roleId),
    columns: { id: true },
  });
  if (!roleRow) return { ok: false, message: "That role could not be found." };

  const parsed = updateRoleSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        name: fieldErrors.name?.[0],
        description: fieldErrors.description?.[0],
        rank: fieldErrors.rank?.[0],
      },
    };
  }

  try {
    await db.update(roles).set(parsed.data).where(eq(roles.id, roleId));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message: "That rank is already taken.",
        fieldErrors: { rank: "That rank is already taken." },
      };
    }
    throw error;
  }

  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Role updated successfully." };
}

export async function deleteRoleAction(
  roleId: string,
): Promise<RoleMutationActionResult> {
  const access = await requireAdmin();
  if (!access.ok) return { ok: false, message: access.message };

  const roleRow = await db.query.roles.findFirst({
    where: eq(roles.id, roleId),
    columns: { id: true, isSystem: true },
  });
  if (!roleRow) return { ok: false, message: "That role could not be found." };
  if (roleRow.isSystem) {
    return { ok: false, message: "System roles cannot be deleted." };
  }

  await db.delete(roles).where(eq(roles.id, roleId));
  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Role deleted successfully." };
}

export async function updateRolePermissionsAction(
  roleId: string,
  permissionIds: string[],
): Promise<RoleMutationActionResult> {
  const access = await requireAdmin();
  if (!access.ok) return { ok: false, message: access.message };

  const roleRow = await db.query.roles.findFirst({
    where: eq(roles.id, roleId),
    columns: { id: true },
  });
  if (!roleRow) return { ok: false, message: "That role could not be found." };

  // Validate permission IDs exist
  if (permissionIds.length > 0) {
    const existingPermissions = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(inArray(permissions.id, permissionIds));

    if (existingPermissions.length !== permissionIds.length) {
      return { ok: false, message: "One or more permissions could not be found." };
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (permissionIds.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(permissionIds.map((permissionId) => ({ roleId, permissionId })));
    }
  });

  revalidatePath("/admin/settings/roles");
  return { ok: true, message: "Role permissions updated successfully." };
}
```

---

## Task 7: Create Shared Form Sheet Component

**Files:**
- Create: `src/components/admin/roles/form-sheet.tsx`

- [ ] **Step 1: Write shared form sheet**

This is a near-copy of `newsletter-form-sheet.tsx` adapted for the roles section.

```tsx
"use client";

import type * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

type FormSheetProps = {
  children: React.ReactNode;
  description: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  open: boolean;
  pendingLabel: string;
  serverMessage?: string | null;
  submitLabel: string;
  title: string;
  trigger?: React.ReactNode;
};

export function FormSheet({
  children,
  description,
  isPending,
  onOpenChange,
  onSubmit,
  open,
  pendingLabel,
  serverMessage,
  submitLabel,
  title,
  trigger,
}: FormSheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent
        className={cn("w-full", isDesktop ? "sm:max-w-lg" : "max-h-[90vh]")}
        side={isDesktop ? "right" : "bottom"}
      >
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form className="grid gap-4 p-4" onSubmit={onSubmit}>
          {children}
          <SheetFooter className="border-t px-0 pb-0">
            {serverMessage ? (
              <p className="flex-1 text-xs font-medium text-destructive">
                {serverMessage}
              </p>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isPending} type="submit">
                {isPending ? pendingLabel : submitLabel}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

---

## Task 8: Create Module Management Components

**Files:**
- Create: `src/components/admin/roles/add-module-sheet.tsx`
- Create: `src/components/admin/roles/edit-module-sheet.tsx`
- Create: `src/components/admin/roles/delete-module-dialog.tsx`
- Create: `src/components/admin/roles/modules-management.tsx`

- [ ] **Step 1: Write add-module-sheet.tsx**

```tsx
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { createModuleAction } from "@/actions/modules";
import { FormSheet } from "@/components/admin/roles/form-sheet";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createModuleSchema,
  type CreateModuleInput,
} from "@/lib/validation/modules";

const defaultValues: CreateModuleInput = {
  key: "",
  name: "",
  description: "",
};

export function AddModuleSheet() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const form = useForm<CreateModuleInput>({
    resolver: zodResolver(createModuleSchema),
    defaultValues,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset(defaultValues);
      form.clearErrors();
      setServerMessage(null);
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    setServerMessage(null);
    form.clearErrors();
    startTransition(async () => {
      const result = await createModuleAction(values);
      if (!result.ok) {
        setServerMessage(result.message);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (message) {
              form.setError(field as keyof CreateModuleInput, { message });
            }
          }
        }
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  });

  return (
    <Form {...form}>
      <FormSheet
        description="Create a new module to group permissions."
        isPending={isPending}
        onOpenChange={handleOpenChange}
        onSubmit={onSubmit}
        open={open}
        pendingLabel="Creating..."
        serverMessage={serverMessage}
        submitLabel="Create module"
        title="Add module"
        trigger={<Button>Add module</Button>}
      >
        <FormField
          control={form.control}
          name="key"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Key</FormLabel>
              <FormControl>
                <Input placeholder="membership-applications" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Membership Applications" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Optional description..." {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSheet>
    </Form>
  );
}
```

- [ ] **Step 2: Write edit-module-sheet.tsx**

```tsx
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { updateModuleAction } from "@/actions/modules";
import { FormSheet } from "@/components/admin/roles/form-sheet";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateModuleSchema,
  type UpdateModuleInput,
} from "@/lib/validation/modules";

type EditableModule = {
  id: string;
  key: string;
  name: string;
  description: string | null;
};

export function EditModuleSheet({ module }: { module: EditableModule }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const defaultValues: UpdateModuleInput = {
    name: module.name,
    description: module.description ?? "",
  };
  const form = useForm<UpdateModuleInput>({
    resolver: zodResolver(updateModuleSchema),
    defaultValues,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset(defaultValues);
      form.clearErrors();
      setServerMessage(null);
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    setServerMessage(null);
    form.clearErrors();
    startTransition(async () => {
      const result = await updateModuleAction(module.id, values);
      if (!result.ok) {
        setServerMessage(result.message);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (message) {
              form.setError(field as keyof UpdateModuleInput, { message });
            }
          }
        }
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  });

  return (
    <Form {...form}>
      <FormSheet
        description={`Update ${module.name}. The key cannot be changed.`}
        isPending={isPending}
        onOpenChange={handleOpenChange}
        onSubmit={onSubmit}
        open={open}
        pendingLabel="Saving..."
        serverMessage={serverMessage}
        submitLabel="Save changes"
        title="Edit module"
        trigger={
          <Button size="xs" type="button" variant="outline">
            Edit
          </Button>
        }
      >
        <div className="grid gap-1">
          <label className="text-sm font-medium">Key</label>
          <Input disabled value={module.key} />
          <p className="text-xs text-muted-foreground">Module keys cannot be changed.</p>
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSheet>
    </Form>
  );
}
```

- [ ] **Step 3: Write delete-module-dialog.tsx**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { deleteModuleAction } from "@/actions/modules";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type DeleteModuleDialogProps = {
  module: {
    id: string;
    name: string;
  };
};

export function DeleteModuleDialog({ module }: DeleteModuleDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = () => {
    setServerMessage(null);
    startTransition(async () => {
      const result = await deleteModuleAction(module.id);
      if (!result.ok) {
        setServerMessage(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button size="xs" type="button" variant="destructive">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete module</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <strong>{module.name}</strong>. This will also delete all permissions
            belonging to this module. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {serverMessage ? (
          <p className="text-xs font-medium text-destructive">{serverMessage}</p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button disabled={isPending} onClick={handleDelete} type="button" variant="destructive">
            {isPending ? "Deleting..." : "Delete module"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: Write modules-management.tsx**

```tsx
"use client";

import { AddModuleSheet } from "@/components/admin/roles/add-module-sheet";
import { DeleteModuleDialog } from "@/components/admin/roles/delete-module-dialog";
import { EditModuleSheet } from "@/components/admin/roles/edit-module-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ModuleListRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
};

function ModuleRows({ rows }: { rows: ModuleListRow[] }) {
  if (!rows.length) {
    return (
      <div className="flex h-32 items-center justify-center px-4 text-center text-xs text-muted-foreground">
        No modules found.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {rows.map((row) => (
        <div
          className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
          key={row.id}
        >
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{row.name}</span>
              <span className="text-xs text-muted-foreground">{row.key}</span>
            </div>
            {row.description ? (
              <p className="text-xs text-muted-foreground">{row.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <EditModuleSheet module={row} />
            <DeleteModuleDialog module={row} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ModulesManagement({ rows }: { rows: ModuleListRow[] }) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">Modules</h2>
          <p className="text-xs text-muted-foreground">
            Modules group related permissions together.
          </p>
        </div>
        <AddModuleSheet />
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>All modules</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ModuleRows rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Task 9: Create Permission Management Components

**Files:**
- Create: `src/components/admin/roles/add-permission-sheet.tsx`
- Create: `src/components/admin/roles/edit-permission-sheet.tsx`
- Create: `src/components/admin/roles/delete-permission-dialog.tsx`
- Create: `src/components/admin/roles/permissions-management.tsx`

- [ ] **Step 1: Write add-permission-sheet.tsx**

```tsx
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { createPermissionAction } from "@/actions/permissions";
import { FormSheet } from "@/components/admin/roles/form-sheet";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createPermissionSchema,
  type CreatePermissionInput,
} from "@/lib/validation/permissions";

type ModuleOption = {
  id: string;
  name: string;
};

const defaultValues: CreatePermissionInput = {
  moduleId: "",
  action: "",
  description: "",
};

export function AddPermissionSheet({ modules }: { modules: ModuleOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const form = useForm<CreatePermissionInput>({
    resolver: zodResolver(createPermissionSchema),
    defaultValues,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset(defaultValues);
      form.clearErrors();
      setServerMessage(null);
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    setServerMessage(null);
    form.clearErrors();
    startTransition(async () => {
      const result = await createPermissionAction(values);
      if (!result.ok) {
        setServerMessage(result.message);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (message) {
              form.setError(field as keyof CreatePermissionInput, { message });
            }
          }
        }
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  });

  return (
    <Form {...form}>
      <FormSheet
        description="Create a new permission. The key is auto-generated from the module and action."
        isPending={isPending}
        onOpenChange={handleOpenChange}
        onSubmit={onSubmit}
        open={open}
        pendingLabel="Creating..."
        serverMessage={serverMessage}
        submitLabel="Create permission"
        title="Add permission"
        trigger={<Button>Add permission</Button>}
      >
        <FormField
          control={form.control}
          name="moduleId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Module</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="action"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Action</FormLabel>
              <FormControl>
                <Input placeholder="create, read, update, delete" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Optional description..." {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSheet>
    </Form>
  );
}
```

- [ ] **Step 2: Write edit-permission-sheet.tsx**

```tsx
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { updatePermissionAction } from "@/actions/permissions";
import { FormSheet } from "@/components/admin/roles/form-sheet";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  updatePermissionSchema,
  type UpdatePermissionInput,
} from "@/lib/validation/permissions";

type EditablePermission = {
  id: string;
  key: string;
  action: string;
  moduleName: string;
  description: string | null;
};

export function EditPermissionSheet({ permission }: { permission: EditablePermission }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const defaultValues: UpdatePermissionInput = {
    description: permission.description ?? "",
  };
  const form = useForm<UpdatePermissionInput>({
    resolver: zodResolver(updatePermissionSchema),
    defaultValues,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset(defaultValues);
      form.clearErrors();
      setServerMessage(null);
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    setServerMessage(null);
    form.clearErrors();
    startTransition(async () => {
      const result = await updatePermissionAction(permission.id, values);
      if (!result.ok) {
        setServerMessage(result.message);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (message) {
              form.setError(field as keyof UpdatePermissionInput, { message });
            }
          }
        }
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  });

  return (
    <Form {...form}>
      <FormSheet
        description={`Update ${permission.key}. Module and action cannot be changed.`}
        isPending={isPending}
        onOpenChange={handleOpenChange}
        onSubmit={onSubmit}
        open={open}
        pendingLabel="Saving..."
        serverMessage={serverMessage}
        submitLabel="Save changes"
        title="Edit permission"
        trigger={
          <Button size="xs" type="button" variant="outline">
            Edit
          </Button>
        }
      >
        <div className="grid gap-1">
          <label className="text-sm font-medium">Key</label>
          <Input disabled value={permission.key} />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Module</label>
          <Input disabled value={permission.moduleName} />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Action</label>
          <Input disabled value={permission.action} />
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSheet>
    </Form>
  );
}
```

Wait — `Input` is not imported in edit-permission-sheet.tsx. Fix that.

Corrected import block for edit-permission-sheet.tsx:
```tsx
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
```

- [ ] **Step 3: Write delete-permission-dialog.tsx**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { deletePermissionAction } from "@/actions/permissions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type DeletePermissionDialogProps = {
  permission: {
    id: string;
    key: string;
  };
};

export function DeletePermissionDialog({ permission }: DeletePermissionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = () => {
    setServerMessage(null);
    startTransition(async () => {
      const result = await deletePermissionAction(permission.id);
      if (!result.ok) {
        setServerMessage(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button size="xs" type="button" variant="destructive">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete permission</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <strong>{permission.key}</strong>. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {serverMessage ? (
          <p className="text-xs font-medium text-destructive">{serverMessage}</p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button disabled={isPending} onClick={handleDelete} type="button" variant="destructive">
            {isPending ? "Deleting..." : "Delete permission"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: Write permissions-management.tsx**

```tsx
"use client";

import { AddPermissionSheet } from "@/components/admin/roles/add-permission-sheet";
import { DeletePermissionDialog } from "@/components/admin/roles/delete-permission-dialog";
import { EditPermissionSheet } from "@/components/admin/roles/edit-permission-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PermissionListRow = {
  id: string;
  key: string;
  action: string;
  description: string | null;
  moduleName: string;
};

export type PermissionModuleOption = {
  id: string;
  name: string;
};

function PermissionRows({ rows }: { rows: PermissionListRow[] }) {
  if (!rows.length) {
    return (
      <div className="flex h-32 items-center justify-center px-4 text-center text-xs text-muted-foreground">
        No permissions found.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {rows.map((row) => (
        <div
          className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
          key={row.id}
        >
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{row.key}</span>
              <span className="text-xs text-muted-foreground">{row.moduleName}</span>
            </div>
            {row.description ? (
              <p className="text-xs text-muted-foreground">{row.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <EditPermissionSheet permission={row} />
            <DeletePermissionDialog permission={row} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PermissionsManagement({
  rows,
  modules,
}: {
  rows: PermissionListRow[];
  modules: PermissionModuleOption[];
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">Permissions</h2>
          <p className="text-xs text-muted-foreground">
            Permissions define actions that can be performed within modules.
          </p>
        </div>
        <AddPermissionSheet modules={modules} />
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>All permissions</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <PermissionRows rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Task 10: Create Role Management Components

**Files:**
- Create: `src/components/admin/roles/add-role-sheet.tsx`
- Create: `src/components/admin/roles/edit-role-sheet.tsx`
- Create: `src/components/admin/roles/delete-role-dialog.tsx`
- Create: `src/components/admin/roles/role-permissions-sheet.tsx`
- Create: `src/components/admin/roles/roles-management.tsx`

- [ ] **Step 1: Write add-role-sheet.tsx**

```tsx
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { createRoleAction } from "@/actions/roles";
import { FormSheet } from "@/components/admin/roles/form-sheet";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createRoleSchema,
  type CreateRoleInput,
} from "@/lib/validation/roles";

const defaultValues: CreateRoleInput = {
  key: "",
  name: "",
  description: "",
  rank: 1,
};

export function AddRoleSheet() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const form = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset(defaultValues);
      form.clearErrors();
      setServerMessage(null);
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    setServerMessage(null);
    form.clearErrors();
    startTransition(async () => {
      const result = await createRoleAction(values);
      if (!result.ok) {
        setServerMessage(result.message);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (message) {
              form.setError(field as keyof CreateRoleInput, { message });
            }
          }
        }
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  });

  return (
    <Form {...form}>
      <FormSheet
        description="Create a new role. Rank determines hierarchy (lower = higher priority)."
        isPending={isPending}
        onOpenChange={handleOpenChange}
        onSubmit={onSubmit}
        open={open}
        pendingLabel="Creating..."
        serverMessage={serverMessage}
        submitLabel="Create role"
        title="Add role"
        trigger={<Button>Add role</Button>}
      >
        <FormField
          control={form.control}
          name="key"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Key</FormLabel>
              <FormControl>
                <Input placeholder="admin, moderator, member" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Admin" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="rank"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rank</FormLabel>
              <FormControl>
                <Input type="number" min={1} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Optional description..." {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSheet>
    </Form>
  );
}
```

- [ ] **Step 2: Write edit-role-sheet.tsx**

```tsx
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { updateRoleAction } from "@/actions/roles";
import { FormSheet } from "@/components/admin/roles/form-sheet";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateRoleSchema,
  type UpdateRoleInput,
} from "@/lib/validation/roles";

type EditableRole = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  rank: number;
};

export function EditRoleSheet({ role }: { role: EditableRole }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const defaultValues: UpdateRoleInput = {
    name: role.name,
    description: role.description ?? "",
    rank: role.rank,
  };
  const form = useForm<UpdateRoleInput>({
    resolver: zodResolver(updateRoleSchema),
    defaultValues,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset(defaultValues);
      form.clearErrors();
      setServerMessage(null);
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    setServerMessage(null);
    form.clearErrors();
    startTransition(async () => {
      const result = await updateRoleAction(role.id, values);
      if (!result.ok) {
        setServerMessage(result.message);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            if (message) {
              form.setError(field as keyof UpdateRoleInput, { message });
            }
          }
        }
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  });

  return (
    <Form {...form}>
      <FormSheet
        description={`Update ${role.name}. The key cannot be changed.`}
        isPending={isPending}
        onOpenChange={handleOpenChange}
        onSubmit={onSubmit}
        open={open}
        pendingLabel="Saving..."
        serverMessage={serverMessage}
        submitLabel="Save changes"
        title="Edit role"
        trigger={
          <Button size="xs" type="button" variant="outline">
            Edit
          </Button>
        }
      >
        <div className="grid gap-1">
          <label className="text-sm font-medium">Key</label>
          <Input disabled value={role.key} />
          <p className="text-xs text-muted-foreground">Role keys cannot be changed.</p>
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="rank"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rank</FormLabel>
              <FormControl>
                <Input type="number" min={1} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSheet>
    </Form>
  );
}
```

- [ ] **Step 3: Write delete-role-dialog.tsx**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { deleteRoleAction } from "@/actions/roles";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type DeleteRoleDialogProps = {
  role: {
    id: string;
    name: string;
    isSystem: boolean;
  };
};

export function DeleteRoleDialog({ role }: DeleteRoleDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = () => {
    setServerMessage(null);
    startTransition(async () => {
      const result = await deleteRoleAction(role.id);
      if (!result.ok) {
        setServerMessage(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (role.isSystem) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button disabled size="xs" type="button" variant="destructive">
              Delete
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>System roles cannot be deleted.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button size="xs" type="button" variant="destructive">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete role</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <strong>{role.name}</strong>. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {serverMessage ? (
          <p className="text-xs font-medium text-destructive">{serverMessage}</p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button disabled={isPending} onClick={handleDelete} type="button" variant="destructive">
            {isPending ? "Deleting..." : "Delete role"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: Write role-permissions-sheet.tsx**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { updateRolePermissionsAction } from "@/actions/roles";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

type PermissionOption = {
  id: string;
  key: string;
  moduleName: string;
};

type RolePermissionsSheetProps = {
  role: {
    id: string;
    name: string;
  };
  permissions: PermissionOption[];
  assignedPermissionIds: string[];
};

export function RolePermissionsSheet({
  role,
  permissions,
  assignedPermissionIds,
}: RolePermissionsSheetProps) {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(
    new Set(assignedPermissionIds),
  );

  React.useEffect(() => {
    setSelected(new Set(assignedPermissionIds));
  }, [assignedPermissionIds, open]);

  const togglePermission = (permissionId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  };

  const handleSave = () => {
    setServerMessage(null);
    startTransition(async () => {
      const result = await updateRolePermissionsAction(role.id, Array.from(selected));
      if (!result.ok) {
        setServerMessage(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  const permissionsByModule = permissions.reduce(
    (acc, permission) => {
      if (!acc[permission.moduleName]) {
        acc[permission.moduleName] = [];
      }
      acc[permission.moduleName].push(permission);
      return acc;
    },
    {} as Record<string, PermissionOption[]>,
  );

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button size="xs" type="button" variant="outline">
          Permissions
        </Button>
      </SheetTrigger>
      <SheetContent
        className={cn("w-full", isDesktop ? "sm:max-w-lg" : "max-h-[90vh]")}
        side={isDesktop ? "right" : "bottom"}
      >
        <SheetHeader className="border-b">
          <SheetTitle>Manage permissions</SheetTitle>
          <SheetDescription>
            Toggle permissions for <strong>{role.name}</strong>.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 overflow-y-auto p-4">
          {Object.entries(permissionsByModule).map(([moduleName, modulePermissions]) => (
            <div className="grid gap-3" key={moduleName}>
              <h3 className="text-sm font-semibold">{moduleName}</h3>
              <div className="grid gap-2">
                {modulePermissions.map((permission) => (
                  <div className="flex items-center gap-2" key={permission.id}>
                    <Checkbox
                      checked={selected.has(permission.id)}
                      id={`permission-${permission.id}`}
                      onCheckedChange={() => togglePermission(permission.id)}
                    />
                    <Label
                      className="text-sm font-normal"
                      htmlFor={`permission-${permission.id}`}
                    >
                      {permission.key}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!permissions.length ? (
            <p className="text-xs text-muted-foreground">No permissions available.</p>
          ) : null}
        </div>
        <SheetFooter className="border-t px-4 py-4">
          {serverMessage ? (
            <p className="flex-1 text-xs font-medium text-destructive">{serverMessage}</p>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isPending} onClick={handleSave} type="button">
              {isPending ? "Saving..." : "Save permissions"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 5: Write roles-management.tsx**

```tsx
"use client";

import { AddRoleSheet } from "@/components/admin/roles/add-role-sheet";
import { DeleteRoleDialog } from "@/components/admin/roles/delete-role-dialog";
import { EditRoleSheet } from "@/components/admin/roles/edit-role-sheet";
import { RolePermissionsSheet } from "@/components/admin/roles/role-permissions-sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type RoleListRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  rank: number;
  isSystem: boolean;
  assignedPermissionIds: string[];
};

export type RolePermissionOption = {
  id: string;
  key: string;
  moduleName: string;
};

function RoleRows({
  rows,
  permissions,
}: {
  rows: RoleListRow[];
  permissions: RolePermissionOption[];
}) {
  if (!rows.length) {
    return (
      <div className="flex h-32 items-center justify-center px-4 text-center text-xs text-muted-foreground">
        No roles found.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {rows.map((row) => (
        <div
          className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
          key={row.id}
        >
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{row.name}</span>
              {row.isSystem ? <Badge variant="outline">System</Badge> : null}
              <span className="text-xs text-muted-foreground">Rank {row.rank}</span>
            </div>
            {row.description ? (
              <p className="text-xs text-muted-foreground">{row.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <RolePermissionsSheet
              assignedPermissionIds={row.assignedPermissionIds}
              permissions={permissions}
              role={row}
            />
            <EditRoleSheet role={row} />
            <DeleteRoleDialog role={row} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RolesManagement({
  rows,
  permissions,
}: {
  rows: RoleListRow[];
  permissions: RolePermissionOption[];
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">Roles</h2>
          <p className="text-xs text-muted-foreground">
            Roles define access levels. Assign permissions to control what each role can do.
          </p>
        </div>
        <AddRoleSheet />
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>All roles</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <RoleRows permissions={permissions} rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Task 11: Create Server Component Page

**Files:**
- Create: `src/app/admin/settings/roles/page.tsx`
- Delete: `src/app/admin/users/page.tsx` (or leave it — it won't be referenced)

- [ ] **Step 1: Write the page component**

```tsx
import { asc, eq } from "drizzle-orm";

import { ModulesManagement } from "@/components/admin/roles/modules-management";
import { PermissionsManagement } from "@/components/admin/roles/permissions-management";
import { RolesManagement } from "@/components/admin/roles/roles-management";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { db } from "@/db";
import { modules, permissions, rolePermissions, roles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminRolesPage() {
  await requireAdmin();

  const modulesRows = await db
    .select({
      id: modules.id,
      key: modules.key,
      name: modules.name,
      description: modules.description,
    })
    .from(modules)
    .orderBy(asc(modules.name));

  const permissionsWithModules = await db
    .select({
      id: permissions.id,
      action: permissions.action,
      key: permissions.key,
      description: permissions.description,
      moduleId: permissions.moduleId,
      moduleName: modules.name,
    })
    .from(permissions)
    .innerJoin(modules, eq(permissions.moduleId, modules.id))
    .orderBy(modules.name, permissions.action);

  const rolesRows = await db
    .select({
      id: roles.id,
      key: roles.key,
      name: roles.name,
      description: roles.description,
      rank: roles.rank,
      isSystem: roles.isSystem,
    })
    .from(roles)
    .orderBy(asc(roles.rank));

  const allRolePermissions = await db
    .select({
      roleId: rolePermissions.roleId,
      permissionId: rolePermissions.permissionId,
    })
    .from(rolePermissions);

  const rolesWithPermissions = rolesRows.map((role) => ({
    ...role,
    assignedPermissionIds: allRolePermissions
      .filter((rp) => rp.roleId === role.id)
      .map((rp) => rp.permissionId),
  }));

  const permissionOptions = permissionsWithModules.map((p) => ({
    id: p.id,
    key: p.key,
    moduleName: p.moduleName,
  }));

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Access Control</h1>
        <p className="text-xs text-muted-foreground">
          Manage modules, permissions, and roles for the application.
        </p>
      </div>
      <Tabs defaultValue="modules">
        <TabsList>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-4" value="modules">
          <ModulesManagement rows={modulesRows} />
        </TabsContent>
        <TabsContent className="mt-4" value="permissions">
          <PermissionsManagement
            modules={modulesRows.map((m) => ({ id: m.id, name: m.name }))}
            rows={permissionsWithModules}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="roles">
          <RolesManagement
            permissions={permissionOptions}
            rows={rolesWithPermissions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Task 12: Cleanup Old Users Page

**Files:**
- Delete: `src/app/admin/users/page.tsx`

- [ ] **Step 1: Remove the old users page**

Delete `src/app/admin/users/page.tsx`.

Note: `src/components/admin/users/*` and `src/actions/users.ts` can be left in place; they are no longer referenced.

---

## Task 13: Type Check

**Files:**
- All of the above

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors related to the new code. Pre-existing errors in test files (bun:test) are acceptable.

---

## Spec Coverage Self-Review

1. **Modules CRUD** → Tasks 4, 8
2. **Permissions CRUD with auto-generated key** → Tasks 5, 9
3. **Roles CRUD** → Tasks 6, 10
4. **Role permissions assignment** → Tasks 6 (action), 10 (sheet)
5. **System roles cannot be deleted** → Task 10 (delete-role-dialog.tsx with tooltip)
6. **Admin nav updated** → Task 2
7. **Old users page removed** → Task 12
8. **Zod validation** → Task 3
9. **Server actions with requireAdmin** → Tasks 4, 5, 6
10. **revalidatePath** → All server action tasks
11. **Empty states** → All management components
12. **Type check** → Task 13

No placeholders found. All types are consistent across files.
