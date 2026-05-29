"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { archiveNewsletterAction } from "@/actions/newsletters";
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

type ArchiveNewsletterDialogProps = {
  newsletter: {
    name: string;
    slug: string;
  };
};

export function ArchiveNewsletterDialog({
  newsletter,
}: ArchiveNewsletterDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleArchive = () => {
    setServerMessage(null);

    startTransition(async () => {
      const result = await archiveNewsletterAction(newsletter.slug);

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
        <Button size="xs" type="button" variant="outline">
          Archive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive newsletter</AlertDialogTitle>
          <AlertDialogDescription>
            Archive {newsletter.name}. Archived newsletters cannot accept new
            submissions, and their submissions cannot be deleted.
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
            onClick={handleArchive}
            type="button"
            variant="destructive"
          >
            {isPending ? "Archiving..." : "Archive newsletter"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
