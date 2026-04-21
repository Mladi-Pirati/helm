"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { legalizirajmoSiNewsletterSubscriptions } from "@/db/schema";
import { getCurrentUser, shouldForcePasswordChange } from "@/lib/auth/session";

type DeleteLegalizirajmoSiNewsletterSubscriptionActionResult =
  | {
      ok: true;
      message?: string;
    }
  | {
      ok: false;
      message: string;
    };

const deleteLegalizirajmoSiNewsletterSubscriptionSchema = z.object({
  subscriptionId: z.string().trim().min(1, "Subscription id is required."),
});

async function requireNewsletterAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false as const,
      message: "You are not allowed to manage newsletter subscriptions.",
    };
  }

  if (shouldForcePasswordChange(user)) {
    return {
      ok: false as const,
      message: "Change your password before managing newsletter subscriptions.",
    };
  }

  if (user.role !== "admin") {
    return {
      ok: false as const,
      message: "You are not allowed to manage newsletter subscriptions.",
    };
  }

  return {
    ok: true as const,
    user,
  };
}

export async function deleteLegalizirajmoSiNewsletterSubscriptionAction(
  subscriptionId: string,
): Promise<DeleteLegalizirajmoSiNewsletterSubscriptionActionResult> {
  const access = await requireNewsletterAdmin();

  if (!access.ok) {
    return {
      ok: false,
      message: access.message,
    };
  }

  const parsedValues =
    deleteLegalizirajmoSiNewsletterSubscriptionSchema.safeParse({
      subscriptionId,
    });

  if (!parsedValues.success) {
    return {
      ok: false,
      message: "That newsletter subscription could not be found.",
    };
  }

  let deletedSubscription:
    | {
        id: string;
      }
    | undefined;

  try {
    [deletedSubscription] = await db
      .delete(legalizirajmoSiNewsletterSubscriptions)
      .where(
        eq(
          legalizirajmoSiNewsletterSubscriptions.id,
          parsedValues.data.subscriptionId,
        ),
      )
      .returning({
        id: legalizirajmoSiNewsletterSubscriptions.id,
      });
  } catch {
    return {
      ok: false,
      message: "Unable to delete the newsletter subscription right now.",
    };
  }

  if (!deletedSubscription) {
    return {
      ok: false,
      message: "That newsletter subscription could not be found.",
    };
  }

  revalidatePath("/admin/legalizirajmo-si-newsletter");

  return {
    ok: true,
    message: "Newsletter subscription deleted successfully.",
  };
}
