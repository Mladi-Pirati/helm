import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  contacts,
  memberRoles,
  members,
  memberships,
  rolePermissions,
  roles,
  permissions,
} from "@/db/schema";
import type { MembersListFilters } from "@/lib/members";

export function buildMembersWhere(filters: MembersListFilters, now = new Date()) {
  const whereClauses = [];

  if (filters.status === "active") {
    whereClauses.push(isNull(members.disabledAt));
  } else if (filters.status === "disabled") {
    whereClauses.push(isNotNull(members.disabledAt));
  }

  if (filters.q) {
    const searchPattern = `%${filters.q}%`;
    whereClauses.push(
      or(
        sql`${members.firstName} ilike ${searchPattern}`,
        sql`${members.lastName} ilike ${searchPattern}`,
        sql`${members.username} ilike ${searchPattern}`,
        sql`${members.keycloakId} ilike ${searchPattern}`,
        sql`exists (
          select 1 from ${contacts}
          where ${contacts.memberId} = ${members.id}
          and ${contacts.type} = 'email'
          and ${contacts.value} ilike ${searchPattern}
        )`,
      ),
    );
  }

  if (filters.roleId) {
    whereClauses.push(
      sql`exists (
        select 1 from ${memberRoles}
        where ${memberRoles.memberId} = ${members.id}
        and ${memberRoles.roleId} = ${filters.roleId}
        and (${memberRoles.expiresAt} is null or ${memberRoles.expiresAt} >= ${now})
      )`,
    );
  }

  if (whereClauses.length === 0) return undefined;
  if (whereClauses.length === 1) return whereClauses[0];
  return and(...whereClauses);
}

export async function getMembersPage(filters: MembersListFilters) {
  const now = new Date();
  const where = buildMembersWhere(filters, now);
  const offset = (filters.page - 1) * filters.pageSize;

  const countQuery = db.select({ value: count() }).from(members);
  const [{ value: totalCount }] = await (where
    ? countQuery.where(where)
    : countQuery);

  const baseRowsQuery = db
    .select({
      disabledAt: members.disabledAt,
      firstName: members.firstName,
      id: members.id,
      keycloakId: members.keycloakId,
      lastName: members.lastName,
      primaryEmail: sql<string | null>`(
        select ${contacts.value}
        from ${contacts}
        where ${contacts.memberId} = ${members.id}
        and ${contacts.type} = 'email'
        order by ${contacts.isPrimary} desc, ${contacts.sortOrder} asc
        limit 1
      )`,
      updatedAt: members.updatedAt,
      username: members.username,
    })
    .from(members);

  const rows = await (where ? baseRowsQuery.where(where) : baseRowsQuery)
    .orderBy(desc(members.updatedAt), asc(members.lastName), asc(members.firstName))
    .limit(filters.pageSize)
    .offset(offset);

  const memberIds = rows.map((row) => row.id);
  const roleRows = memberIds.length
    ? await db
        .select({
          memberId: memberRoles.memberId,
          roleId: roles.id,
          roleKey: roles.key,
          roleName: roles.name,
        })
        .from(memberRoles)
        .innerJoin(roles, eq(memberRoles.roleId, roles.id))
        .where(
          and(
            inArray(memberRoles.memberId, memberIds),
            or(isNull(memberRoles.expiresAt), gte(memberRoles.expiresAt, now)),
          ),
        )
        .orderBy(asc(roles.rank))
    : [];
  const membershipRows = memberIds.length
    ? await db
        .select({
          endedAt: memberships.endedAt,
          expiresAt: memberships.expiresAt,
          extendedAt: memberships.extendedAt,
          memberId: memberships.memberId,
        })
        .from(memberships)
        .where(inArray(memberships.memberId, memberIds))
        .orderBy(desc(memberships.extendedAt))
    : [];

  return {
    pageCount: Math.max(1, Math.ceil(Number(totalCount) / filters.pageSize)),
    rows: rows.map((row) => ({
      ...row,
      currentMembership: (() => {
        const currentMembership = membershipRows.find(
          (membership) =>
            membership.memberId === row.id &&
            membership.endedAt === null &&
            (membership.expiresAt === null || membership.expiresAt >= now),
        );

        return currentMembership
          ? {
              expiresAt: currentMembership.expiresAt,
              extendedAt: currentMembership.extendedAt,
            }
          : null;
      })(),
      roles: roleRows
        .filter((role) => role.memberId === row.id)
        .map((role) => ({
          id: role.roleId,
          key: role.roleKey,
          name: role.roleName,
        })),
    })),
    totalCount: Number(totalCount),
  };
}

export async function roleGrantsAnyPermission(
  roleIds: string[],
  permissionKeys: string[],
) {
  if (roleIds.length === 0 || permissionKeys.length === 0) return false;

  const rows = await db
    .select({ id: roles.id })
    .from(roles)
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        inArray(roles.id, roleIds),
        inArray(permissions.key, permissionKeys),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
