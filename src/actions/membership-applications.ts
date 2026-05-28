"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  type MembershipApplicationStatus,
  mladiPiratiMembershipApplications,
} from "@/db/schema";
import { hasPermission } from "@/lib/auth/permissions";
import {
  hasValidRejectionReason,
  reviewMembershipApplicationStatuses,
  type ReviewMembershipApplicationStatus,
} from "@/lib/membership-applications";

type MembershipApplicationActionFailure = {
  ok: false;
  message: string;
};

type UpdateMembershipApplicationStatusActionResult =
  | {
      ok: true;
      status: MembershipApplicationStatus;
      rejectionReason: string | null;
      updatedAt: string;
    }
  | MembershipApplicationActionFailure;

type DeleteMembershipApplicationActionResult =
  | {
      ok: true;
      message?: string;
    }
  | MembershipApplicationActionFailure;

const updateMembershipApplicationStatusSchema = z.object({
  applicationId: z.string().trim().min(1, "Application id is required."),
  status: z.enum(reviewMembershipApplicationStatuses),
  rejectionReason: z.string().optional(),
}).superRefine((values, context) => {
  if (
    values.status === "rejected" &&
    !hasValidRejectionReason(values.rejectionReason ?? "")
  ) {
    context.addIssue({
      code: "custom",
      message: "Please enter a rejection reason with at least 4 words.",
      path: ["rejectionReason"],
    });
  }
});

const deleteMembershipApplicationSchema = z.object({
  applicationId: z.string().trim().min(1, "Application id is required."),
});

async function requireMembershipApplicationsPermission() {
  const allowed = await hasPermission("members.read");
  if (!allowed) {
    return {
      ok: false as const,
      message: "You are not allowed to review membership applications.",
    };
  }
  return { ok: true as const };
}

export async function updateMembershipApplicationStatusAction(
  applicationId: string,
  values: {
    status: ReviewMembershipApplicationStatus;
    rejectionReason?: string;
  },
): Promise<UpdateMembershipApplicationStatusActionResult> {
  const access = await requireMembershipApplicationsPermission();

  if (!access.ok) {
    return {
      ok: false,
      message: access.message,
    };
  }

  const parsedValues = updateMembershipApplicationStatusSchema.safeParse({
    applicationId,
    ...values,
  });

  if (!parsedValues.success) {
    return {
      ok: false,
      message:
        parsedValues.error.issues[0]?.message ??
        "Please choose a valid application status.",
    };
  }

  const rejectionReason =
    parsedValues.data.status === "rejected"
      ? (parsedValues.data.rejectionReason?.trim() ?? null)
      : null;

  let updatedApplication:
    | {
        status: MembershipApplicationStatus;
        rejectionReason: string | null;
        updatedAt: Date;
      }
    | undefined;

  try {
    [updatedApplication] = await db
      .update(mladiPiratiMembershipApplications)
      .set({
        status: parsedValues.data.status,
        rejectionReason,
        updatedAt: new Date(),
      })
      .where(
        eq(
          mladiPiratiMembershipApplications.id,
          parsedValues.data.applicationId,
        ),
      )
      .returning({
        status: mladiPiratiMembershipApplications.status,
        rejectionReason: mladiPiratiMembershipApplications.rejectionReason,
        updatedAt: mladiPiratiMembershipApplications.updatedAt,
      });
  } catch {
    return {
      ok: false,
      message: "Unable to update the application right now.",
    };
  }

  if (!updatedApplication) {
    return {
      ok: false,
      message: "That application could not be found.",
    };
  }

  revalidatePath("/admin/membership-applications");
  revalidatePath(
    `/admin/membership-applications/${parsedValues.data.applicationId}`,
  );

  return {
    ok: true,
    status: updatedApplication.status,
    rejectionReason: updatedApplication.rejectionReason,
    updatedAt: updatedApplication.updatedAt.toISOString(),
  };
}

export async function deleteMembershipApplicationAction(
  applicationId: string,
): Promise<DeleteMembershipApplicationActionResult> {
  const access = await requireMembershipApplicationsPermission();

  if (!access.ok) {
    return {
      ok: false,
      message: access.message,
    };
  }

  const parsedValues = deleteMembershipApplicationSchema.safeParse({
    applicationId,
  });

  if (!parsedValues.success) {
    return {
      ok: false,
      message: "That application could not be found.",
    };
  }

  let deletedApplication:
    | {
        id: string;
      }
    | undefined;

  try {
    [deletedApplication] = await db
      .delete(mladiPiratiMembershipApplications)
      .where(
        eq(
          mladiPiratiMembershipApplications.id,
          parsedValues.data.applicationId,
        ),
      )
      .returning({
        id: mladiPiratiMembershipApplications.id,
      });
  } catch {
    return {
      ok: false,
      message: "Unable to delete the application right now.",
    };
  }

  if (!deletedApplication) {
    return {
      ok: false,
      message: "That application could not be found.",
    };
  }

  revalidatePath("/admin/membership-applications");
  revalidatePath(
    `/admin/membership-applications/${parsedValues.data.applicationId}`,
  );

  return {
    ok: true,
    message: "Application deleted successfully.",
  };
}
