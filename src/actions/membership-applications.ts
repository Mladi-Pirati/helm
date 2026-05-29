"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  type MemberCreationStatus,
  type MembershipApplicationStatus,
  mladiPiratiMembershipApplications,
} from "@/db/schema";
import { hasPermission } from "@/lib/auth/permissions";
import { provisionMembershipApplicationMember } from "@/lib/membership-application-provisioning";
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
      memberCreationStatus: MemberCreationStatus | null;
      memberCreationMessage?: string;
      updatedAt: string;
    }
  | MembershipApplicationActionFailure;

type RetryMembershipApplicationMemberCreationActionResult =
  | {
      ok: true;
      memberCreationStatus: MemberCreationStatus;
      message: string;
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

const retryMembershipApplicationMemberCreationSchema = z.object({
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

function revalidateMembershipApplicationPaths(applicationId: string) {
  revalidatePath("/admin/members/applications");
  revalidatePath(`/admin/members/applications/${applicationId}`);
  revalidatePath("/admin/members");
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
        memberCreationStatus: MemberCreationStatus | null;
        updatedAt: Date;
      }
    | undefined;

  try {
    [updatedApplication] = await db
      .update(mladiPiratiMembershipApplications)
      .set({
        status: parsedValues.data.status,
        rejectionReason,
        memberCreationStatus: null,
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
        memberCreationStatus:
          mladiPiratiMembershipApplications.memberCreationStatus,
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

  let memberCreationMessage: string | undefined;

  if (updatedApplication.status === "approved") {
    const memberCreationStatus = await createMemberForApprovedApplication(
      parsedValues.data.applicationId,
    );
    updatedApplication.memberCreationStatus = memberCreationStatus;
    memberCreationMessage =
      memberCreationStatus === "success"
        ? "Member profile created successfully."
        : "Application approved, but member creation failed. Please retry.";
  }

  revalidateMembershipApplicationPaths(parsedValues.data.applicationId);

  return {
    ok: true,
    status: updatedApplication.status,
    rejectionReason: updatedApplication.rejectionReason,
    memberCreationStatus: updatedApplication.memberCreationStatus,
    memberCreationMessage,
    updatedAt: updatedApplication.updatedAt.toISOString(),
  };
}

export async function retryMembershipApplicationMemberCreationAction(
  applicationId: string,
): Promise<RetryMembershipApplicationMemberCreationActionResult> {
  const access = await requireMembershipApplicationsPermission();

  if (!access.ok) {
    return {
      ok: false,
      message: access.message,
    };
  }

  const parsedValues = retryMembershipApplicationMemberCreationSchema.safeParse({
    applicationId,
  });

  if (!parsedValues.success) {
    return {
      ok: false,
      message: "That application could not be found.",
    };
  }

  const application = await getApplicationForMemberCreation(
    parsedValues.data.applicationId,
  );

  if (!application) {
    return {
      ok: false,
      message: "That application could not be found.",
    };
  }

  if (application.status !== "approved") {
    return {
      ok: false,
      message: "Only approved applications can create member profiles.",
    };
  }

  const memberCreationStatus = await createMemberForApprovedApplication(
    parsedValues.data.applicationId,
  );

  revalidateMembershipApplicationPaths(parsedValues.data.applicationId);

  return {
    ok: true,
    memberCreationStatus,
    message:
      memberCreationStatus === "success"
        ? "Member profile created successfully."
        : "Member creation failed. Please retry after resolving the issue.",
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

  revalidateMembershipApplicationPaths(parsedValues.data.applicationId);

  return {
    ok: true,
    message: "Application deleted successfully.",
  };
}

async function createMemberForApprovedApplication(applicationId: string) {
  const application = await getApplicationForMemberCreation(applicationId);

  if (!application || application.status !== "approved") {
    return "fail" satisfies MemberCreationStatus;
  }

  try {
    await provisionMembershipApplicationMember(application);
    await setApplicationMemberCreationStatus(applicationId, "success");
    return "success" satisfies MemberCreationStatus;
  } catch (error) {
    console.error("[membership-application-member-creation]", {
      applicationId,
      error:
        error instanceof Error
          ? { message: error.message, name: error.name }
          : String(error),
    });
    await setApplicationMemberCreationStatus(applicationId, "fail");
    return "fail" satisfies MemberCreationStatus;
  }
}

async function getApplicationForMemberCreation(applicationId: string) {
  return db.query.mladiPiratiMembershipApplications.findFirst({
    columns: {
      cityAndPostalCode: true,
      discordUsername: true,
      email: true,
      firstName: true,
      id: true,
      lastName: true,
      phone: true,
      status: true,
      streetAddress: true,
    },
    where: eq(mladiPiratiMembershipApplications.id, applicationId),
  });
}

async function setApplicationMemberCreationStatus(
  applicationId: string,
  memberCreationStatus: MemberCreationStatus,
) {
  await db
    .update(mladiPiratiMembershipApplications)
    .set({
      memberCreationStatus,
      updatedAt: new Date(),
    })
    .where(eq(mladiPiratiMembershipApplications.id, applicationId));
}
