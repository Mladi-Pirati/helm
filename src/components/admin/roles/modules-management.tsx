"use client";

import { AddModuleSheet } from "@/components/admin/roles/add-module-sheet";
import { DeleteModuleDialog } from "@/components/admin/roles/delete-module-dialog";
import { EditModuleSheet } from "@/components/admin/roles/edit-module-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ModuleListRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
};

function ModuleRows({ rows }: { rows: Array<ModuleListRow> }) {
  if (!rows.length) {
    return (
      <div className="flex h-32 items-center justify-center px-4 text-center text-xs text-muted-foreground">
        No modules found.
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
              <span className="text-xs text-muted-foreground">{row.key}</span>
            </div>
            {row.description ? (
              <p className="text-xs text-muted-foreground">
                {row.description}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <EditModuleSheet module={row} />
            <DeleteModuleDialog module={row} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ModulesManagement({ rows }: { rows: Array<ModuleListRow> }) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">Modules</h2>
          <p className="text-xs text-muted-foreground">
            Modules group related permissions together.
          </p>
        </div>
        <AddModuleSheet />
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>All modules</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ModuleRows rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
