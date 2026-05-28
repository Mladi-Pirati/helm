import "dotenv/config";

import { eq, count } from "drizzle-orm";

import { db } from "@/db";
import { modules, permissions, roles, rolePermissions } from "@/db/schema";

async function seed() {
  // Check if already seeded
  const [moduleCount, permCount, roleCount] = await Promise.all([
    db.select({ count: count() }).from(modules),
    db.select({ count: count() }).from(permissions),
    db.select({ count: count() }).from(roles),
  ]);

  if (moduleCount[0].count > 0 || permCount[0].count > 0 || roleCount[0].count > 0) {
    console.log("Seed already applied, skipping.");
    return;
  }

  // Seed modules
  await db.insert(modules).values([
    { key: "access-control", name: "Access Control", description: "" },
    { key: "members", name: "Members", description: "Member management module" },
    { key: "newsletters", name: "Newsletters", description: "" },
  ]);

  // Fetch module IDs
  const mAccessControl = await db.query.modules.findFirst({ where: eq(modules.key, "access-control") });
  const mMembers = await db.query.modules.findFirst({ where: eq(modules.key, "members") });
  const mNewsletters = await db.query.modules.findFirst({ where: eq(modules.key, "newsletters") });

  if (!mAccessControl || !mMembers || !mNewsletters) {
    throw new Error("Failed to fetch seeded modules");
  }

  // Seed permissions
  const permDefs = [
    { moduleId: mAccessControl.id, key: "access-control.manage_modules", action: "manage_modules", description: "Module management" },
    { moduleId: mAccessControl.id, key: "access-control.manage_permissions", action: "manage_permissions", description: "Manage permissions" },
    { moduleId: mAccessControl.id, key: "access-control.manage_roles", action: "manage_roles", description: "Role management" },
    { moduleId: mMembers.id, key: "members.create", action: "create", description: "Create a new member" },
    { moduleId: mMembers.id, key: "members.delete", action: "delete", description: "Delete members" },
    { moduleId: mMembers.id, key: "members.read", action: "read", description: "View members and their data" },
    { moduleId: mMembers.id, key: "members.role_management", action: "role_management", description: "Manage roles of other users" },
    { moduleId: mMembers.id, key: "members.update", action: "update", description: "Update member information" },
    { moduleId: mNewsletters.id, key: "newsletters.create", action: "create", description: "Create new newsletters" },
    { moduleId: mNewsletters.id, key: "newsletters.delete", action: "delete", description: "Delete newsletters" },
    { moduleId: mNewsletters.id, key: "newsletters.read", action: "read", description: "View newsletters and their entries" },
    { moduleId: mNewsletters.id, key: "newsletters.update", action: "update", description: "Update the newsletters and subscribers" },
  ];

  await db.insert(permissions).values(permDefs);

  // Seed Super Admin role
  await db.insert(roles).values({
    key: "superadmin",
    name: "Super Admin",
    rank: 420,
    isSystem: true,
  });

  const superadminRole = await db.query.roles.findFirst({ where: eq(roles.key, "superadmin") });
  if (!superadminRole) {
    throw new Error("Failed to fetch superadmin role");
  }

  const allPerms = await db.select({ id: permissions.id }).from(permissions);

  await db.insert(rolePermissions).values(
    allPerms.map((p) => ({ roleId: superadminRole.id, permissionId: p.id }))
  );

  console.log("Seed complete!");
}

seed().catch(console.error).finally(() => process.exit(0));
