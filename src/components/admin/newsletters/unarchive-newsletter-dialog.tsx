"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { unarchiveNewsletterAction } from "@/actions/newsletters";
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

type UnarchiveNewsletterDialogProps = {
  newsletter: {
    name: string;
    slug: string;
  };
};

export function UnarchiveNewsletterDialog({
  newsletter,
}: UnarchiveNewsletterDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleUnarchive = () => {
    setServerMessage(null);

    startTransition(async () => {
      const result = await unarchiveNewsletterAction(newsletter.slug);

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
          Unarchive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unarchive newsletter</AlertDialogTitle>
          <AlertDialogDescription>
            Move {newsletter.name} back to the active newsletter list and allow
            new public submissions again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {serverMessage ? (
          <p className="text-xs font-medium text-destructive">
            {serverMessage}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button disabled={isPending} onClick={handleUnarchive} type="button">
            {isPending ? "Unarchiving..." : "Unarchive newsletter"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
