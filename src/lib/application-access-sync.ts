import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  accessApplications,
  memberApplicationAccess,
  members,
} from "@/db/schema";
import { createKeycloakAdminClient } from "@/lib/keycloak/admin-client";

export type ApplicationAccessRole = {
  keycloakClientId: string;
  keycloakRoleName: string;
};

function toAssignment(application: ApplicationAccessRole) {
  return {
    clientId: application.keycloakClientId,
    roleName: application.keycloakRoleName,
  };
}

export async function addKeycloakApplicationRole(values: {
  application: ApplicationAccessRole;
  keycloakId: string;
}) {
  await createKeycloakAdminClient().addClientRole(
    values.keycloakId,
    toAssignment(values.application),
  );
}

export async function removeKeycloakApplicationRole(values: {
  application: ApplicationAccessRole;
  keycloakId: string;
}) {
  await createKeycloakAdminClient().removeClientRole(
    values.keycloakId,
    toAssignment(values.application),
  );
}

export async function syncMemberApplicationRoles(values: {
  disabled: boolean;
  keycloakId: string;
  memberId: string;
}) {
  const rows = await db
    .select({
      keycloakClientId: accessApplications.keycloakClientId,
      keycloakRoleName: accessApplications.keycloakRoleName,
    })
    .from(memberApplicationAccess)
    .innerJoin(
      accessApplications,
      eq(memberApplicationAccess.applicationId, accessApplications.id),
    )
    .where(
      and(
        eq(memberApplicationAccess.memberId, values.memberId),
        isNull(accessApplications.archivedAt),
      ),
    );

  const keycloak = createKeycloakAdminClient();
  for (const row of rows) {
    const assignment = toAssignment(row);
    if (values.disabled) {
      await keycloak.removeClientRole(values.keycloakId, assignment);
    } else {
      await keycloak.addClientRole(values.keycloakId, assignment);
    }
  }
}

export async function syncArchivedApplicationRoles(values: {
  applicationId: string;
  archived: boolean;
}) {
  const rows = await db
    .select({
      keycloakId: members.keycloakId,
      keycloakClientId: accessApplications.keycloakClientId,
      keycloakRoleName: accessApplications.keycloakRoleName,
    })
    .from(memberApplicationAccess)
    .innerJoin(members, eq(memberApplicationAccess.memberId, members.id))
    .innerJoin(
      accessApplications,
      eq(memberApplicationAccess.applicationId, accessApplications.id),
    )
    .where(
      and(
        eq(memberApplicationAccess.applicationId, values.applicationId),
        isNull(members.disabledAt),
      ),
    );

  const keycloak = createKeycloakAdminClient();
  for (const row of rows) {
    const assignment = toAssignment(row);
    if (values.archived) {
      await keycloak.removeClientRole(row.keycloakId, assignment);
    } else {
      await keycloak.addClientRole(row.keycloakId, assignment);
    }
  }
}

export async function syncApplicationMappingChange(values: {
  applicationId: string;
  nextApplication: ApplicationAccessRole;
  previousApplication: ApplicationAccessRole;
}) {
  const rows = await db
    .select({ keycloakId: members.keycloakId })
    .from(memberApplicationAccess)
    .innerJoin(members, eq(memberApplicationAccess.memberId, members.id))
    .where(
      and(
        eq(memberApplicationAccess.applicationId, values.applicationId),
        isNull(members.disabledAt),
      ),
    );

  const keycloak = createKeycloakAdminClient();
  for (const row of rows) {
    await keycloak.removeClientRole(
      row.keycloakId,
      toAssignment(values.previousApplication),
    );
    await keycloak.addClientRole(
      row.keycloakId,
      toAssignment(values.nextApplication),
    );
  }
}
