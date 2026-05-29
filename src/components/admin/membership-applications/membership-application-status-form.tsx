"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateMembershipApplicationStatusAction } from "@/actions/membership-applications";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getRejectionReasonWordCount,
  hasValidRejectionReason,
} from "@/lib/membership-applications";

export function MembershipApplicationStatusForm({
  applicationId,
  currentRejectionReason,
}: {
  applicationId: string;
  currentRejectionReason: string | null;
}) {
  const router = useRouter();
  const [isEditingRejectionReason, setIsEditingRejectionReason] =
    useState(false);
  const [savedRejectionReason, setSavedRejectionReason] = useState(
    currentRejectionReason,
  );
  const [rejectionReason, setRejectionReason] = useState(
    currentRejectionReason ?? "",
  );
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const wordCount = getRejectionReasonWordCount(rejectionReason);
  const canReject = hasValidRejectionReason(rejectionReason);

  const reviewApplication = (
    values:
      | {
          status: "approved";
        }
      | {
          status: "rejected";
          rejectionReason: string;
        },
  ) => {
    setFeedback(null);

    startTransition(async () => {
      const result = await updateMembershipApplicationStatusAction(
        applicationId,
        values,
      );

      if (!result.ok) {
        setFeedback({
          kind: "error",
          message: result.message,
        });
        return;
      }

      setFeedback({
        kind: "success",
        message:
          values.status === "approved"
            ? "Application approved."
            : "Application rejected.",
      });
      if (result.status === "approved") {
        setSavedRejectionReason(null);
        setRejectionReason("");
        setIsEditingRejectionReason(false);
      } else {
        setSavedRejectionReason(result.rejectionReason);
        setRejectionReason(result.rejectionReason ?? "");
        setIsEditingRejectionReason(false);
      }
      router.refresh();
    });
  };

  return (
    <div className="grid gap-3 sm:max-w-xl">
      <div className="flex flex-wrap items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={isPending} type="button">
              Approve
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve application?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the membership application as approved and clear
                any saved rejection reason.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={() => reviewApplication({ status: "approved" })}
              >
                {isPending ? "Approving..." : "Approve"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {savedRejectionReason ? null : (
          <Button
            disabled={isPending}
            onClick={() => {
              setFeedback(null);
              setIsEditingRejectionReason(true);
            }}
            type="button"
            variant="destructive"
          >
            Reject
          </Button>
        )}
        {feedback ? (
          <p
            className={
              feedback.kind === "error"
                ? "text-xs font-medium text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {feedback.message}
          </p>
        ) : null}
      </div>
      {savedRejectionReason && !isEditingRejectionReason ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Rejection reason
            </p>
            <Button
              disabled={isPending}
              onClick={() => {
                setFeedback(null);
                setRejectionReason(savedRejectionReason);
                setIsEditingRejectionReason(true);
              }}
              size="xs"
              type="button"
              variant="outline"
            >
              Edit
            </Button>
          </div>
          <p className="whitespace-pre-wrap text-xs/relaxed text-foreground">
            {savedRejectionReason}
          </p>
        </div>
      ) : null}
      {isEditingRejectionReason ? (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();

            if (!canReject) {
              setFeedback({
                kind: "error",
                message: "Please enter a rejection reason with at least 4 words.",
              });
              return;
            }

            reviewApplication({
              status: "rejected",
              rejectionReason,
            });
          }}
        >
          <label
            className="text-xs font-medium text-foreground"
            htmlFor="rejectionReason"
          >
            Rejection reason
          </label>
          <Textarea
            disabled={isPending}
            id="rejectionReason"
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Explain why this application is being rejected."
            value={rejectionReason}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={isPending || !canReject} type="submit">
              {isPending ? "Rejecting..." : "Confirm rejection"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {wordCount}/4 words minimum
            </p>
          </div>
        </form>
      ) : null}
    </div>
  );
}
