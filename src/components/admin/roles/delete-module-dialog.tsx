"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { deleteModuleAction } from "@/actions/modules";
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

type DeleteModuleDialogProps = {
  module: {
    id: string;
    name: string;
  };
};

export function DeleteModuleDialog({ module }: DeleteModuleDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = () => {
    setServerMessage(null);
    startTransition(async () => {
      const result = await deleteModuleAction(module.id);
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
          <AlertDialogTitle>Delete module</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <strong>{module.name}</strong>. This will also delete all
            permissions belonging to this module. This action cannot be undone.
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
            {isPending ? "Deleting..." : "Delete module"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
