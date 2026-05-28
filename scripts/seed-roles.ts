import "dotenv/config";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  members,
  modules,
  permissions,
  rolePermissions,
  roles,
} from "@/db/schema";

async function seed() {
  console.log("Seeding roles and permissions...");

  // ── MODULES ─────────────────────────────────────────────
  const membersModule = await db
    .insert(modules)
    .values({
      key: "members",
      name: "Members",
      description: "Membership and member management",
    })
    .onConflictDoNothing({ target: modules.key })
    .returning();

  const newslettersModule = await db
    .insert(modules)
    .values({
      key: "newsletters",
      name: "Newsletters",
      description: "Newsletter and subscription management",
    })
    .onConflictDoNothing({ target: modules.key })
    .returning();

  const settingsModule = await db
    .insert(modules)
    .values({
      key: "settings",
      name: "Settings",
      description: "Admin settings, roles and permissions",
    })
    .onConflictDoNothing({ target: modules.key })
    .returning();

  // Get IDs (handle both insert and existing rows)
  const getModule = async (key: string) => {
    const existing = await db.query.modules.findFirst({
      where: eq(modules.key, key),
    });
    if (!existing) throw new Error(`Module ${key} not found`);
    return existing;
  };

  const mMembers = await getModule("members");
  const mNewsletters = await getModule("newsletters");
  const mSettings = await getModule("settings");

  // ── PERMISSIONS ─────────────────────────────────────────
  const permissionDefs = [
    // Members
    { moduleId: mMembers.id, action: "create", key: "members.create" },
    { moduleId: mMembers.id, action: "read", key: "members.read" },
    { moduleId: mMembers.id, action: "update", key: "members.update" },
    { moduleId: mMembers.id, action: "delete", key: "members.delete" },
    // Newsletters
    { moduleId: mNewsletters.id, action: "create", key: "newsletters.create" },
    { moduleId: mNewsletters.id, action: "read", key: "newsletters.read" },
    { moduleId: mNewsletters.id, action: "update", key: "newsletters.update" },
    { moduleId: mNewsletters.id, action: "delete", key: "newsletters.delete" },
    { moduleId: mNewsletters.id, action: "publish", key: "newsletters.publish" },
    // Settings
    { moduleId: mSettings.id, action: "read", key: "settings.read" },
    { moduleId: mSettings.id, action: "update", key: "settings.update" },
  ];

  for (const p of permissionDefs) {
    await db
      .insert(permissions)
      .values(p)
      .onConflictDoNothing({ target: permissions.key });
  }

  // Fetch all permission IDs
  const allPermissions = await db.select().from(permissions);
  const permByKey = new Map(allPermissions.map((p) => [p.key, p.id]));

  // ── ROLES ───────────────────────────────────────────────
  const roleDefs = [
    {
      key: "admin",
      name: "Administrator",
      description: "Full system access",
      rank: 100,
      isSystem: true,
      permissionKeys: permissionDefs.map((p) => p.key),
    },
    {
      key: "editor",
      name: "Editor",
      description: "Can manage newsletters and view members",
      rank: 50,
      isSystem: true,
      permissionKeys: [
        "members.read",
        "newsletters.create",
        "newsletters.read",
        "newsletters.update",
        "newsletters.delete",
        "newsletters.publish",
      ],
    },
    {
      key: "viewer",
      name: "Viewer",
      description: "Read-only access",
      rank: 10,
      isSystem: true,
      permissionKeys: ["members.read", "newsletters.read"],
    },
  ];

  for (const roleDef of roleDefs) {
    const [role] = await db
      .insert(roles)
      .values({
        key: roleDef.key,
        name: roleDef.name,
        description: roleDef.description,
        rank: roleDef.rank,
        isSystem: roleDef.isSystem,
      })
      .onConflictDoNothing({ target: roles.key })
      .returning();

    const roleId = role?.id;
    if (!roleId) {
      // Role already exists, fetch it
      const existing = await db.query.roles.findFirst({
        where: eq(roles.key, roleDef.key),
      });
      if (!existing) throw new Error(`Role ${roleDef.key} not found`);
      continue; // Skip permission assignment for existing roles
    }

    // Assign permissions
    for (const permKey of roleDef.permissionKeys) {
      const permId = permByKey.get(permKey);
      if (permId) {
        await db
          .insert(rolePermissions)
          .values({ roleId, permissionId: permId })
          .onConflictDoNothing();
      }
    }
  }

  console.log("Seed complete!");
}

seed()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
