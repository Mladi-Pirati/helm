import type { DefaultSession } from "next-auth";

import type { UserRole } from "@/db/schema";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      fullName: string;
      keycloakUserId: string;
      username: string;
      forcePasswordChange: boolean;
      role: UserRole;
    };
  }

  interface User {
    id: string;
    fullName: string;
    keycloakUserId: string;
    username: string;
    forcePasswordChange: boolean;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    fullName?: string;
    keycloakUserId?: string;
    username?: string;
    forcePasswordChange?: boolean;
    role?: UserRole;
  }
}
