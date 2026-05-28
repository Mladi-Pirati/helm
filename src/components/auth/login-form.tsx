"use client";

import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function LoginForm({ errorMessage }: { errorMessage?: string }) {
  return (
    <form action={loginAction} className="grid gap-4">
      {errorMessage ? (
        <p className="text-xs font-medium text-destructive">{errorMessage}</p>
      ) : null}
      <Button className="w-full" type="submit">
        Sign in with Keycloak
      </Button>
    </form>
  );
}
