import { asc, eq } from "drizzle-orm";

import { ApplicationsManagement } from "@/components/admin/roles/applications-management";
import { ModulesManagement } from "@/components/admin/roles/modules-management";
import { PermissionsManagement } from "@/components/admin/roles/permissions-management";
import { RolesManagement } from "@/components/admin/roles/roles-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import {
  accessApplications,
  memberApplicationAccess,
  modules,
  permissions,
  rolePermissions,
  roles,
} from "@/db/schema";
import {
  getCurrentUserHighestRoleRank,
  requirePermission,
} from "@/lib/auth/permissions";

export default async function AdminRolesPage() {
  await requirePermission("access-control.manage_roles");
  const highestManagedRank = await getCurrentUserHighestRoleRank();

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

  const applicationRows = await db
    .select({
      archivedAt: accessApplications.archivedAt,
      description: accessApplications.description,
      id: accessApplications.id,
      keycloakClientId: accessApplications.keycloakClientId,
      keycloakRoleName: accessApplications.keycloakRoleName,
      name: accessApplications.name,
    })
    .from(accessApplications)
    .orderBy(asc(accessApplications.archivedAt), asc(accessApplications.name));

  const applicationAccessRows = await db
    .select({
      applicationId: memberApplicationAccess.applicationId,
    })
    .from(memberApplicationAccess);

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
  const assignedCountsByApplication = applicationAccessRows.reduce(
    (counts, row) => {
      counts.set(row.applicationId, (counts.get(row.applicationId) ?? 0) + 1);
      return counts;
    },
    new Map<string, number>(),
  );

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
          <TabsTrigger value="applications">Applications</TabsTrigger>
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
            highestManagedRank={highestManagedRank}
            permissions={permissionOptions}
            rows={rolesWithPermissions}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="applications">
          <ApplicationsManagement
            rows={applicationRows.map((row) => ({
              ...row,
              archivedAt: row.archivedAt?.toISOString() ?? null,
              assignedMemberCount: assignedCountsByApplication.get(row.id) ?? 0,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
