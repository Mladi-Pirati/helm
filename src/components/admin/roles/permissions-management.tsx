"use client";

import { AddPermissionSheet } from "@/components/admin/roles/add-permission-sheet";
import { DeletePermissionDialog } from "@/components/admin/roles/delete-permission-dialog";
import { EditPermissionSheet } from "@/components/admin/roles/edit-permission-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PermissionListRow = {
  id: string;
  key: string;
  action: string;
  description: string | null;
  moduleName: string;
};

export type PermissionModuleOption = {
  id: string;
  name: string;
};

function PermissionRows({ rows }: { rows: Array<PermissionListRow> }) {
  if (!rows.length) {
    return (
      <div className="flex h-32 items-center justify-center px-4 text-center text-xs text-muted-foreground">
        No permissions found.
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
              <span className="font-medium text-foreground">{row.key}</span>
              <span className="text-xs text-muted-foreground">
                {row.moduleName}
              </span>
            </div>
            {row.description ? (
              <p className="text-xs text-muted-foreground">
                {row.description}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <EditPermissionSheet permission={row} />
            <DeletePermissionDialog permission={row} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PermissionsManagement({
  rows,
  modules,
}: {
  rows: Array<PermissionListRow>;
  modules: Array<PermissionModuleOption>;
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">Permissions</h2>
          <p className="text-xs text-muted-foreground">
            Permissions define actions that can be performed within modules.
          </p>
        </div>
        <AddPermissionSheet modules={modules} />
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>All permissions</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <PermissionRows rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
