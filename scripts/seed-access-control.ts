import "dotenv/config";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { modules, permissions, roles, rolePermissions } from "@/db/schema";

async function seed() {
  // Seed modules
  await db
    .insert(modules)
    .values([
      { key: "access-control", name: "Access Control", description: "" },
      {
        key: "members",
        name: "Members",
        description: "Member management module",
      },
      { key: "newsletters", name: "Newsletters", description: "" },
    ])
    .onConflictDoNothing({ target: modules.key });

  // Fetch module IDs
  const mAccessControl = await db.query.modules.findFirst({
    where: eq(modules.key, "access-control"),
  });
  const mMembers = await db.query.modules.findFirst({
    where: eq(modules.key, "members"),
  });
  const mNewsletters = await db.query.modules.findFirst({
    where: eq(modules.key, "newsletters"),
  });

  if (!mAccessControl || !mMembers || !mNewsletters) {
    throw new Error("Failed to fetch seeded modules");
  }

  // Seed permissions
  const permDefs = [
    {
      moduleId: mAccessControl.id,
      key: "access-control.manage_modules",
      action: "manage_modules",
      description: "Module management",
    },
    {
      moduleId: mAccessControl.id,
      key: "access-control.manage_permissions",
      action: "manage_permissions",
      description: "Manage permissions",
    },
    {
      moduleId: mAccessControl.id,
      key: "access-control.manage_roles",
      action: "manage_roles",
      description: "Role management",
    },
    {
      moduleId: mMembers.id,
      key: "members.create",
      action: "create",
      description: "Create a new member",
    },
    {
      moduleId: mMembers.id,
      key: "members.delete",
      action: "delete",
      description: "Delete members",
    },
    {
      moduleId: mMembers.id,
      key: "members.read",
      action: "read",
      description: "View members and their data",
    },
    {
      moduleId: mMembers.id,
      key: "members.role_management",
      action: "role_management",
      description: "Manage roles of other users",
    },
    {
      moduleId: mMembers.id,
      key: "members.update",
      action: "update",
      description: "Update member information",
    },
    {
      moduleId: mNewsletters.id,
      key: "newsletters.create",
      action: "create",
      description: "Create new newsletters",
    },
    {
      moduleId: mNewsletters.id,
      key: "newsletters.delete",
      action: "delete",
      description: "Delete newsletters",
    },
    {
      moduleId: mNewsletters.id,
      key: "newsletters.read",
      action: "read",
      description: "View newsletters and their entries",
    },
    {
      moduleId: mNewsletters.id,
      key: "newsletters.update",
      action: "update",
      description: "Update the newsletters and subscribers",
    },
  ];

  for (const permDef of permDefs) {
    await db
      .insert(permissions)
      .values(permDef)
      .onConflictDoNothing({ target: permissions.key });
  }

  // Seed Super Admin role
  await db
    .insert(roles)
    .values({
      key: "superadmin",
      name: "Super Admin",
      rank: 420,
      isSystem: true,
    })
    .onConflictDoNothing({ target: roles.key });

  const superadminRole = await db.query.roles.findFirst({
    where: eq(roles.key, "superadmin"),
  });
  if (!superadminRole) {
    throw new Error("Failed to fetch superadmin role");
  }

  const allPerms = await db.select({ id: permissions.id }).from(permissions);

  for (const perm of allPerms) {
    await db
      .insert(rolePermissions)
      .values({ roleId: superadminRole.id, permissionId: perm.id })
      .onConflictDoNothing();
  }

  console.log("Seed complete!");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
