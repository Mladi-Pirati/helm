"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deletePermissionAction } from "@/actions/permissions";
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

type DeletePermissionDialogProps = {
  permission: {
    id: string;
    key: string;
  };
};

export function DeletePermissionDialog({
  permission,
}: DeletePermissionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    setServerMessage(null);
    startTransition(async () => {
      const result = await deletePermissionAction(permission.id);
      if (!result.ok) {
        setServerMessage(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button size="xs" type="button" variant="destructive">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete permission</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <strong>{permission.key}</strong>. This action cannot be
            undone.
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
            {isPending ? "Deleting..." : "Delete permission"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
