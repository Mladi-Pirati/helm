"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateRolePermissionsAction } from "@/actions/roles";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

type PermissionOption = {
  id: string;
  key: string;
  moduleName: string;
};

type RolePermissionsSheetProps = {
  role: {
    id: string;
    name: string;
  };
  permissions: Array<PermissionOption>;
  assignedPermissionIds: Array<string>;
};

export function RolePermissionsSheet({
  role,
  permissions,
  assignedPermissionIds,
}: RolePermissionsSheetProps) {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(assignedPermissionIds),
  );

  const togglePermission = (permissionId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  };

  const handleSave = () => {
    setServerMessage(null);
    startTransition(async () => {
      const result = await updateRolePermissionsAction(
        role.id,
        Array.from(selected),
      );
      if (!result.ok) {
        setServerMessage(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setSelected(new Set(assignedPermissionIds));
      setServerMessage(null);
    }
  };

  const permissionsByModule = permissions.reduce(
    (acc, permission) => {
      if (!acc[permission.moduleName]) {
        acc[permission.moduleName] = [];
      }
      acc[permission.moduleName].push(permission);
      return acc;
    },
    {} as Record<string, Array<PermissionOption>>,
  );

  return (
    <Sheet onOpenChange={handleOpenChange} open={open}>
      <SheetTrigger asChild>
        <Button size="xs" type="button" variant="outline">
          Permissions
        </Button>
      </SheetTrigger>
      <SheetContent
        className={cn("w-full", isDesktop ? "sm:max-w-lg" : "max-h-[90vh]")}
        side={isDesktop ? "right" : "bottom"}
      >
        <SheetHeader className="border-b">
          <SheetTitle>Manage permissions</SheetTitle>
          <SheetDescription>
            Toggle permissions for <strong>{role.name}</strong>.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 overflow-y-auto p-4">
          {Object.entries(permissionsByModule).map(
            ([moduleName, modulePermissions]) => (
              <div className="grid gap-3" key={moduleName}>
                <h3 className="text-sm font-semibold">{moduleName}</h3>
                <div className="grid gap-2">
                  {modulePermissions.map((permission) => (
                    <div
                      className="flex items-center gap-2"
                      key={permission.id}
                    >
                      <Checkbox
                        checked={selected.has(permission.id)}
                        id={`permission-${permission.id}`}
                        onCheckedChange={() => togglePermission(permission.id)}
                      />
                      <Label
                        className="text-sm font-normal"
                        htmlFor={`permission-${permission.id}`}
                      >
                        {permission.key}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
          {!permissions.length ? (
            <p className="text-xs text-muted-foreground">
              No permissions available.
            </p>
          ) : null}
        </div>
        <SheetFooter className="border-t px-4 py-4">
          {serverMessage ? (
            <p className="flex-1 text-xs font-medium text-destructive">
              {serverMessage}
            </p>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending} onClick={handleSave} type="button">
              {isPending ? "Saving..." : "Save permissions"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
