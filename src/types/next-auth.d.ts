import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      fullName: string;
      keycloakUserId: string;
      username: string;
    };
  }

  interface User {
    id: string;
    fullName: string;
    keycloakUserId: string;
    username: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    fullName?: string;
    keycloakUserId?: string;
    username?: string;
  }
}
