"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { newsletters, newsletterSubscriptions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createNewsletterSchema,
  type CreateNewsletterInput,
  updateNewsletterSchema,
  type UpdateNewsletterInput,
} from "@/lib/validation/newsletters";

type ActionSuccess = {
  ok: true;
  message?: string;
};

type ActionFailure<TField extends string = string> = {
  ok: false;
  message: string;
  fieldErrors?: Partial<Record<TField, string>>;
};

type CreateNewsletterActionResult =
  | (ActionSuccess & { newsletterSlug: string })
  | ActionFailure<keyof CreateNewsletterInput>;

type UpdateNewsletterActionResult =
  | ActionSuccess
  | ActionFailure<keyof UpdateNewsletterInput>;

type NewsletterMutationActionResult = ActionSuccess | ActionFailure;

function isUniqueViolation(error: unknown) {
  let currentError: unknown = error;

  while (typeof currentError === "object" && currentError !== null) {
    if ("code" in currentError && currentError.code === "23505") {
      return true;
    }

    if (!("cause" in currentError)) {
      return false;
    }

    currentError = currentError.cause;
  }

  return false;
}

async function requireNewsletterAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false as const,
      message: "You are not allowed to manage newsletters.",
    };
  }

  if (user.role !== "admin") {
    return {
      ok: false as const,
      message: "You are not allowed to manage newsletters.",
    };
  }

  return {
    ok: true as const,
    user,
  };
}

async function getNewsletterBySlug(slug: string) {
  return db.query.newsletters.findFirst({
    where: sql`lower(${newsletters.slug}) = ${slug.toLowerCase()}`,
    columns: {
      id: true,
      slug: true,
      archivedAt: true,
    },
  });
}

export async function createNewsletterAction(
  values: CreateNewsletterInput,
): Promise<CreateNewsletterActionResult> {
  const access = await requireNewsletterAdmin();

  if (!access.ok) {
    return {
      ok: false,
      message: access.message,
    };
  }

  const parsedValues = createNewsletterSchema.safeParse(values);

  if (!parsedValues.success) {
    const fieldErrors = parsedValues.error.flatten().fieldErrors;

    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        name: fieldErrors.name?.[0],
        slug: fieldErrors.slug?.[0],
        description: fieldErrors.description?.[0],
      },
    };
  }

  const existingNewsletter = await getNewsletterBySlug(parsedValues.data.slug);

  if (existingNewsletter) {
    return {
      ok: false,
      message: "That slug is already taken.",
      fieldErrors: {
        slug: "That slug is already taken.",
      },
    };
  }

  try {
    await db.insert(newsletters).values(parsedValues.data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message: "That slug is already taken.",
        fieldErrors: {
          slug: "That slug is already taken.",
        },
      };
    }

    throw error;
  }

  revalidatePath("/admin/newsletters");

  return {
    ok: true,
    newsletterSlug: parsedValues.data.slug,
  };
}

export async function updateNewsletterAction(
  newsletterSlug: string,
  values: UpdateNewsletterInput,
): Promise<UpdateNewsletterActionResult> {
  const access = await requireNewsletterAdmin();

  if (!access.ok) {
    return {
      ok: false,
      message: access.message,
    };
  }

  const newsletter = await getNewsletterBySlug(newsletterSlug);

  if (!newsletter) {
    return {
      ok: false,
      message: "That newsletter could not be found.",
    };
  }

  const parsedValues = updateNewsletterSchema.safeParse(values);

  if (!parsedValues.success) {
    const fieldErrors = parsedValues.error.flatten().fieldErrors;

    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        name: fieldErrors.name?.[0],
        description: fieldErrors.description?.[0],
      },
    };
  }

  await db
    .update(newsletters)
    .set(parsedValues.data)
    .where(eq(newsletters.id, newsletter.id));

  revalidatePath("/admin/newsletters");
  revalidatePath(`/admin/newsletters/${newsletter.slug}`);

  return {
    ok: true,
    message: "Newsletter updated successfully.",
  };
}

export async function archiveNewsletterAction(
  newsletterSlug: string,
): Promise<NewsletterMutationActionResult> {
  const access = await requireNewsletterAdmin();

  if (!access.ok) {
    return {
      ok: false,
      message: access.message,
    };
  }

  const newsletter = await getNewsletterBySlug(newsletterSlug);

  if (!newsletter) {
    return {
      ok: false,
      message: "That newsletter could not be found.",
    };
  }

  if (newsletter.archivedAt) {
    return {
      ok: true,
      message: "Newsletter is already archived.",
    };
  }

  await db
    .update(newsletters)
    .set({ archivedAt: new Date() })
    .where(eq(newsletters.id, newsletter.id));

  revalidatePath("/admin/newsletters");
  revalidatePath(`/admin/newsletters/${newsletter.slug}`);

  return {
    ok: true,
    message: "Newsletter archived successfully.",
  };
}

export async function unarchiveNewsletterAction(
  newsletterSlug: string,
): Promise<NewsletterMutationActionResult> {
  const access = await requireNewsletterAdmin();

  if (!access.ok) {
    return {
      ok: false,
      message: access.message,
    };
  }

  const newsletter = await getNewsletterBySlug(newsletterSlug);

  if (!newsletter) {
    return {
      ok: false,
      message: "That newsletter could not be found.",
    };
  }

  if (!newsletter.archivedAt) {
    return {
      ok: true,
      message: "Newsletter is already active.",
    };
  }

  await db
    .update(newsletters)
    .set({ archivedAt: null })
    .where(eq(newsletters.id, newsletter.id));

  revalidatePath("/admin/newsletters");
  revalidatePath(`/admin/newsletters/${newsletter.slug}`);

  return {
    ok: true,
    message: "Newsletter unarchived successfully.",
  };
}

export async function deleteNewsletterSubscriptionAction(
  subscriptionId: string,
): Promise<NewsletterMutationActionResult> {
  const access = await requireNewsletterAdmin();

  if (!access.ok) {
    return {
      ok: false,
      message: access.message,
    };
  }

  const [subscription] = await db
    .select({
      id: newsletterSubscriptions.id,
      newsletterSlug: newsletters.slug,
      archivedAt: newsletters.archivedAt,
    })
    .from(newsletterSubscriptions)
    .innerJoin(
      newsletters,
      eq(newsletterSubscriptions.newsletterId, newsletters.id),
    )
    .where(eq(newsletterSubscriptions.id, subscriptionId))
    .limit(1);

  if (!subscription) {
    return {
      ok: false,
      message: "That newsletter subscription could not be found.",
    };
  }

  if (subscription.archivedAt) {
    return {
      ok: false,
      message: "Archived newsletter submissions cannot be deleted.",
    };
  }

  const [deletedSubscription] = await db
    .delete(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.id, subscription.id))
    .returning({
      id: newsletterSubscriptions.id,
    });

  if (!deletedSubscription) {
    return {
      ok: false,
      message: "That newsletter subscription could not be found.",
    };
  }

  revalidatePath(`/admin/newsletters/${subscription.newsletterSlug}`);

  return {
    ok: true,
    message: "Newsletter subscription deleted successfully.",
  };
}
