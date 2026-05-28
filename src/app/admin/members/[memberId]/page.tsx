import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { MemberDetailManagement } from "@/components/admin/members/member-detail-management";
import { db } from "@/db";
import {
  addresses,
  contacts,
  memberRoles,
  members,
  memberships,
  roles,
} from "@/db/schema";
import { getCurrentUserPermissions, requirePermission } from "@/lib/auth/permissions";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  await requirePermission("members.read");
  const { memberId } = await params;
  const { permissions } = await getCurrentUserPermissions();
  const canUpdate = permissions.includes("members.update");
  const canManageRoles = permissions.includes("members.role_management");

  const member = await db.query.members.findFirst({
    where: eq(members.id, memberId),
  });

  if (!member) notFound();

  const [contactRows, addressRows, membershipRows, roleRows, assignedRoleRows] =
    await Promise.all([
      db
        .select({
          id: contacts.id,
          isPrimary: contacts.isPrimary,
          label: contacts.label,
          sortOrder: contacts.sortOrder,
          type: contacts.type,
          value: contacts.value,
        })
        .from(contacts)
        .where(eq(contacts.memberId, member.id))
        .orderBy(asc(contacts.sortOrder)),
      db
        .select({
          city: addresses.city,
          country: addresses.country,
          id: addresses.id,
          label: addresses.label,
          postalCode: addresses.postalCode,
          street: addresses.street,
        })
        .from(addresses)
        .where(eq(addresses.memberId, member.id))
        .orderBy(asc(addresses.label), asc(addresses.city)),
      db
        .select({
          endedAt: memberships.endedAt,
          expiresAt: memberships.expiresAt,
          extendedAt: memberships.extendedAt,
          id: memberships.id,
        })
        .from(memberships)
        .where(eq(memberships.memberId, member.id))
        .orderBy(desc(memberships.expiresAt)),
      db
        .select({
          id: roles.id,
          key: roles.key,
          name: roles.name,
        })
        .from(roles)
        .orderBy(asc(roles.rank)),
      db
        .select({
          expiresAt: memberRoles.expiresAt,
          id: roles.id,
          key: roles.key,
          name: roles.name,
        })
        .from(memberRoles)
        .innerJoin(roles, eq(memberRoles.roleId, roles.id))
        .where(eq(memberRoles.memberId, member.id))
        .orderBy(asc(roles.rank)),
    ]);

  const primaryEmail =
    contactRows.find((contact) => contact.type === "email" && contact.isPrimary)
      ?.value ??
    contactRows.find((contact) => contact.type === "email")?.value ??
    "";

  return (
    <MemberDetailManagement
      addresses={addressRows}
      assignedRoles={assignedRoleRows.map((role) => ({
        ...role,
        expiresAt: role.expiresAt?.toISOString() ?? null,
      }))}
      canManageRoles={canManageRoles}
      canUpdate={canUpdate}
      contacts={contactRows}
      member={{
        disabledAt: member.disabledAt?.toISOString() ?? null,
        firstName: member.firstName,
        id: member.id,
        keycloakId: member.keycloakId,
        lastName: member.lastName,
        notes: member.notes,
        primaryEmail,
        username: member.username,
      }}
      memberships={membershipRows.map((membership) => ({
        ...membership,
        endedAt: membership.endedAt?.toISOString() ?? null,
        expiresAt: membership.expiresAt?.toISOString() ?? null,
        extendedAt: membership.extendedAt.toISOString(),
      }))}
      roles={roleRows}
    />
  );
}
