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
