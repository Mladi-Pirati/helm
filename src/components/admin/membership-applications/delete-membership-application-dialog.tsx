"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteMembershipApplicationAction } from "@/actions/membership-applications";
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
import type { MembershipApplicationListRow } from "./membership-applications-management";

function getApplicationDisplayName(row: MembershipApplicationListRow) {
  return `${row.firstName} ${row.lastName}`.trim();
}

export function DeleteMembershipApplicationDialog({
  row,
}: {
  row: MembershipApplicationListRow;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    setServerMessage(null);

    startTransition(async () => {
      const result = await deleteMembershipApplicationAction(row.id);

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
          <AlertDialogTitle>Delete application</AlertDialogTitle>
          <AlertDialogDescription>
            Delete the membership application for {getApplicationDisplayName(row)}{" "}
            ({row.email}) permanently. This action cannot be undone.
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
            {isPending ? "Deleting..." : "Delete application"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
