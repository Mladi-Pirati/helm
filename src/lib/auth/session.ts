import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";

const appSessionUserSchema = z
  .object({
    forcePasswordChange: z.boolean(),
    fullName: z.string().min(1),
    id: z.string().min(1),
    keycloakUserId: z.string().min(1),
    role: z.enum(["admin", "viewer"]),
    username: z.string().min(1),
  })
  .passthrough();

export function isAppSessionUser(user: unknown) {
  return appSessionUserSchema.safeParse(user).success;
}

export const getCurrentUser = cache(async () => {
  const session = await auth();
  const user = session?.user;

  if (!isAppSessionUser(user)) {
    return null;
  }

  return user;
});

export const requireUser = cache(async () => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
});

export const requireReadyUser = cache(async () => {
  return requireUser();
});

export const requireAdmin = cache(async () => {
  const user = await requireReadyUser();

  if (user.role !== "admin") {
    forbidden();
  }

  return user;
});
