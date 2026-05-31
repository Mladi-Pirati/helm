"use server";

import { signIn, signOut } from "@/auth";

export async function loginAction() {
  await signIn("keycloak", {
    redirectTo: "/admin",
  });
}

export async function logoutAction() {
  await signOut({
    redirectTo: "/login",
  });
}
