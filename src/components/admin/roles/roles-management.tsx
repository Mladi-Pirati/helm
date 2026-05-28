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
              <span className="text-xs text-muted-foreground">
                Rank {row.rank}
              </span>
            </div>
            {row.description ? (
              <p className="text-xs text-muted-foreground">
                {row.description}
              </p>
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
            Roles define access levels. Assign permissions to control what each
            role can do.
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
