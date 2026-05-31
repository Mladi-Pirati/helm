"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { bulkMembershipApplicationAction } from "@/actions/membership-applications";
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
import { Textarea } from "@/components/ui/textarea";
import {
  getRejectionReasonWordCount,
  hasValidRejectionReason,
  type BulkMembershipApplicationAction,
} from "@/lib/membership-applications";
import type { MembershipApplicationListRow } from "./membership-applications-management";

type BulkMembershipApplicationActionDialogProps = {
  action: BulkMembershipApplicationAction;
  children: ReactNode;
  disabled?: boolean;
  onSuccess: (message: string) => void;
  rows: MembershipApplicationListRow[];
};

const actionLabels: Record<
  BulkMembershipApplicationAction,
  {
    confirm: string;
    pending: string;
    title: string;
    variant?: "default" | "destructive" | "outline";
  }
> = {
  approve: {
    confirm: "Approve applications",
    pending: "Approving...",
    title: "Approve selected applications?",
  },
  reject: {
    confirm: "Reject applications",
    pending: "Rejecting...",
    title: "Reject selected applications?",
    variant: "destructive",
  },
  pending: {
    confirm: "Set back to pending",
    pending: "Updating...",
    title: "Set selected applications back to pending?",
  },
  delete: {
    confirm: "Delete applications",
    pending: "Deleting...",
    title: "Delete selected applications?",
    variant: "destructive",
  },
};

function getApplicationPreview(rows: MembershipApplicationListRow[]) {
  const preview = rows
    .slice(0, 3)
    .map((row) => `${row.firstName} ${row.lastName}`.trim() || row.email)
    .join(", ");

  if (rows.length <= 3) {
    return preview;
  }

  return `${preview}, and ${rows.length - 3} more`;
}

function getActionDescription(
  action: BulkMembershipApplicationAction,
  count: number,
) {
  switch (action) {
    case "approve":
      return `This will approve ${count} selected applications, clear any rejection reasons, and create member profiles for them.`;
    case "reject":
      return `This will reject ${count} selected applications using the shared rejection reason below.`;
    case "pending":
      return `This will set ${count} selected applications back to pending and clear rejection reasons and member creation statuses. Already-created member profiles will not be removed.`;
    case "delete":
      return `This will permanently delete ${count} selected applications. This action cannot be undone.`;
    default:
      return `This will update ${count} selected applications.`;
  }
}

export function BulkMembershipApplicationActionDialog({
  action,
  children,
  disabled = false,
  onSuccess,
  rows,
}: BulkMembershipApplicationActionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const labels = actionLabels[action];
  const selectedCount = rows.length;
  const wordCount = getRejectionReasonWordCount(rejectionReason);
  const canSubmit =
    selectedCount > 0 &&
    (action !== "reject" || hasValidRejectionReason(rejectionReason));

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setRejectionReason("");
      setServerMessage(null);
    }
  };

  const handleConfirm = () => {
    setServerMessage(null);

    if (!canSubmit) {
      setServerMessage(
        action === "reject"
          ? "Please enter a rejection reason with at least 4 words."
          : "Select at least one application.",
      );
      return;
    }

    startTransition(async () => {
      const result = await bulkMembershipApplicationAction({
        action,
        applicationIds: rows.map((row) => row.id),
        rejectionReason: action === "reject" ? rejectionReason : undefined,
      });

      if (!result.ok) {
        setServerMessage(result.message);
        return;
      }

      setOpen(false);
      onSuccess(result.message);
      router.refresh();
    });
  };

  return (
    <AlertDialog onOpenChange={handleOpenChange} open={open}>
      <AlertDialogTrigger asChild disabled={disabled}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{labels.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {getActionDescription(action, selectedCount)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {selectedCount ? (
          <p className="text-xs text-muted-foreground">
            Selected: {getApplicationPreview(rows)}
          </p>
        ) : null}
        {action === "reject" ? (
          <div className="grid gap-2">
            <label
              className="text-xs font-medium text-foreground"
              htmlFor="bulkRejectionReason"
            >
              Rejection reason
            </label>
            <Textarea
              disabled={isPending}
              id="bulkRejectionReason"
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Explain why these applications are being rejected."
              value={rejectionReason}
            />
            <p className="text-xs text-muted-foreground">
              {wordCount}/4 words minimum
            </p>
          </div>
        ) : null}
        {serverMessage ? (
          <p className="text-xs font-medium text-destructive">
            {serverMessage}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            disabled={isPending || !canSubmit}
            onClick={handleConfirm}
            type="button"
            variant={labels.variant}
          >
            {isPending ? labels.pending : labels.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
