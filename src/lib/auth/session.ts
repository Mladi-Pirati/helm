import { cache } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";

const appSessionUserSchema = z
  .object({
    fullName: z.string().min(1),
    id: z.string().min(1),
    keycloakUserId: z.string().min(1),
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
