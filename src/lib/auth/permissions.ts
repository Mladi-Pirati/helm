import { cache } from "react";
import { eq, and, isNull, gte, sql } from "drizzle-orm";
import { forbidden } from "next/navigation";

import { db } from "@/db";
import { members, memberRoles, permissions, rolePermissions, roles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Get all permission keys for a given member ID.
 * Respects role expiration (granted_at <= now <= expires_at).
 */
async function getMemberPermissionKeys(memberId: string): Promise<Set<string>> {
  const now = new Date();

  const results = await db
    .select({
      permissionKey: permissions.key,
    })
    .from(memberRoles)
    .innerJoin(rolePermissions, eq(memberRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(memberRoles.memberId, memberId),
        // Not expired: expires_at IS NULL OR expires_at >= now
        sql`${memberRoles.expiresAt} IS NULL OR ${memberRoles.expiresAt} >= ${now}`,
      ),
    );

  return new Set(results.map((r) => r.permissionKey));
}

/**
 * Check if the current user has a specific permission.
 * Returns false if not authenticated or no permission.
 *
 * Legacy fallback: users with role === "admin" in the users table
 * are treated as superusers (all permissions).
 */
export async function hasPermission(permissionKey: string): Promise<boolean> {
  const user = await getCurrentUser();

  if (!user) {
    return false;
  }

  // Legacy superuser fallback
  if (user.role === "admin") {
    return true;
  }

  // Find member by keycloak_id
  const member = await db.query.members.findFirst({
    where: eq(members.keycloakId, user.keycloakUserId),
    columns: { id: true },
  });

  if (!member) {
    // No member record yet — legacy viewer has no permissions
    return false;
  }

  const permissionKeys = await getMemberPermissionKeys(member.id);
  return permissionKeys.has(permissionKey);
}

/**
 * Check if the current user has ALL of the specified permissions.
 */
export async function hasAllPermissions(...permissionKeys: string[]): Promise<boolean> {
  if (permissionKeys.length === 0) return true;

  const user = await getCurrentUser();
  if (!user) return false;

  // Legacy superuser fallback
  if (user.role === "admin") return true;

  const member = await db.query.members.findFirst({
    where: eq(members.keycloakId, user.keycloakUserId),
    columns: { id: true },
  });

  if (!member) return false;

  const keys = await getMemberPermissionKeys(member.id);
  return permissionKeys.every((k) => keys.has(k));
}

/**
 * Check if the current user has ANY of the specified permissions.
 */
export async function hasAnyPermission(...permissionKeys: string[]): Promise<boolean> {
  if (permissionKeys.length === 0) return true;

  const user = await getCurrentUser();
  if (!user) return false;

  // Legacy superuser fallback
  if (user.role === "admin") return true;

  const member = await db.query.members.findFirst({
    where: eq(members.keycloakId, user.keycloakUserId),
    columns: { id: true },
  });

  if (!member) return false;

  const keys = await getMemberPermissionKeys(member.id);
  return permissionKeys.some((k) => keys.has(k));
}

/**
 * Require a specific permission. Throws 403 if the user lacks it.
 * Use in server components and server actions.
 */
export const requirePermission = cache(async (permissionKey: string) => {
  const allowed = await hasPermission(permissionKey);

  if (!allowed) {
    forbidden();
  }
});

/**
 * Require ALL of the specified permissions. Throws 403 if the user lacks any.
 */
export const requireAllPermissions = cache(async (...permissionKeys: string[]) => {
  const allowed = await hasAllPermissions(...permissionKeys);

  if (!allowed) {
    forbidden();
  }
});

/**
 * Require ANY of the specified permissions. Throws 403 if the user has none.
 */
export const requireAnyPermission = cache(async (...permissionKeys: string[]) => {
  const allowed = await hasAnyPermission(...permissionKeys);

  if (!allowed) {
    forbidden();
  }
});

/**
 * Get the full permission set and role info for the current user.
 * Useful for rendering UI conditionally (e.g., showing/hiding buttons).
 */
export async function getCurrentUserPermissions(): Promise<{
  permissions: string[];
  roles: { id: string; key: string; name: string }[];
}> {
  const user = await getCurrentUser();

  if (!user) {
    return { permissions: [], roles: [] };
  }

  // Legacy superuser
  if (user.role === "admin") {
    const allPerms = await db.select({ key: permissions.key }).from(permissions);
    return {
      permissions: allPerms.map((p) => p.key),
      roles: [{ id: "legacy", key: "admin", name: "Administrator (Legacy)" }],
    };
  }

  const member = await db.query.members.findFirst({
    where: eq(members.keycloakId, user.keycloakUserId),
    columns: { id: true },
  });

  if (!member) {
    return { permissions: [], roles: [] };
  }

  const now = new Date();

  const [permResults, roleResults] = await Promise.all([
    db
      .select({ key: permissions.key })
      .from(memberRoles)
      .innerJoin(rolePermissions, eq(memberRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(memberRoles.memberId, member.id),
          sql`${memberRoles.expiresAt} IS NULL OR ${memberRoles.expiresAt} >= ${now}`,
        ),
      ),
    db
      .select({
        id: roles.id,
        key: roles.key,
        name: roles.name,
      })
      .from(memberRoles)
      .innerJoin(roles, eq(memberRoles.roleId, roles.id))
      .where(
        and(
          eq(memberRoles.memberId, member.id),
          sql`${memberRoles.expiresAt} IS NULL OR ${memberRoles.expiresAt} >= ${now}`,
        ),
      ),
  ]);

  return {
    permissions: [...new Set(permResults.map((p) => p.key))],
    roles: roleResults,
  };
}
