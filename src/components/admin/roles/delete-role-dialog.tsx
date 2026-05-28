"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { deleteRoleAction } from "@/actions/roles";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type DeleteRoleDialogProps = {
  role: {
    id: string;
    name: string;
    isSystem: boolean;
  };
};

export function DeleteRoleDialog({ role }: DeleteRoleDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = () => {
    setServerMessage(null);
    startTransition(async () => {
      const result = await deleteRoleAction(role.id);
      if (!result.ok) {
        setServerMessage(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (role.isSystem) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button disabled size="xs" type="button" variant="destructive">
              Delete
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>System roles cannot be deleted.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button size="xs" type="button" variant="destructive">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete role</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <strong>{role.name}</strong>. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {serverMessage ? (
          <p className="text-xs font-medium text-destructive">
            {serverMessage}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            disabled={isPending}
            onClick={handleDelete}
            type="button"
            variant="destructive"
          >
            {isPending ? "Deleting..." : "Delete role"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
