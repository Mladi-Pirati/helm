import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
  getKeycloakFullNameFromProfile,
  getKeycloakUsernameFromProfile,
  keycloakAccessTokenHasClientRole,
  keycloakProfileHasClientRole,
} from "@/lib/auth/keycloak-access";

const keycloakProfileSchema = z
  .object({
    sub: z.string().min(1),
  })
  .passthrough();

async function getSessionUserByKeycloakUserId(keycloakUserId: string) {
  return db.query.users.findFirst({
    where: eq(users.keycloakUserId, keycloakUserId),
    columns: {
      id: true,
      fullName: true,
      keycloakUserId: true,
      username: true,
      role: true,
    },
  });
}

async function hasKeycloakManagedUsers() {
  const rows = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(isNotNull(users.keycloakUserId))
    .limit(1);

  return rows.length > 0;
}

function hasClientRole(profile: unknown, accessToken: unknown) {
  return (
    keycloakProfileHasClientRole(profile, process.env.KEYCLOAK_CLIENT_ID ?? "") ||
    keycloakAccessTokenHasClientRole(
      accessToken,
      process.env.KEYCLOAK_CLIENT_ID ?? "",
    )
  );
}

async function ensureLocalUserForSignIn(profile: unknown, accessToken: unknown) {
  const parsedProfile = keycloakProfileSchema.safeParse(profile);

  if (!parsedProfile.success || !hasClientRole(profile, accessToken)) {
    return false;
  }

  const existingUser = await getSessionUserByKeycloakUserId(
    parsedProfile.data.sub,
  );

  if (existingUser) {
    return true;
  }

  if (await hasKeycloakManagedUsers()) {
    return false;
  }

  const username =
    getKeycloakUsernameFromProfile(profile) ?? parsedProfile.data.sub;
  const fullName = getKeycloakFullNameFromProfile(profile) ?? username;
  const existingUsernameUser = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: {
      id: true,
    },
  });

  if (existingUsernameUser) {
    await db
      .update(users)
      .set({
        forcePasswordChange: false,
        fullName,
        keycloakUserId: parsedProfile.data.sub,
        passwordHash: "",
        role: "admin",
      })
      .where(eq(users.id, existingUsernameUser.id));

    return true;
  }

  await db.insert(users).values({
    forcePasswordChange: false,
    fullName,
    keycloakUserId: parsedProfile.data.sub,
    passwordHash: "",
    role: "admin",
    username,
  });

  return true;
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      issuer: process.env.KEYCLOAK_ISSUER,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "keycloak") {
        return false;
      }

      return ensureLocalUserForSignIn(profile, account.access_token);
    },
    async jwt({ token, account, profile }) {
      const parsedProfile = keycloakProfileSchema.safeParse(profile);

      if (parsedProfile.success) {
        token.keycloakUserId = parsedProfile.data.sub;
      }

      if (account?.provider === "keycloak" && !token.keycloakUserId) {
        return null;
      }

      if (typeof token.keycloakUserId === "string") {
        const currentUser = await getSessionUserByKeycloakUserId(
          token.keycloakUserId,
        );

        if (!currentUser) {
          return null;
        }

        token.sub = currentUser.id;
        token.fullName = currentUser.fullName;
        token.keycloakUserId = currentUser.keycloakUserId ?? undefined;
        token.name = currentUser.fullName;
        token.username = currentUser.username;
        token.forcePasswordChange = false;
        token.role = currentUser.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (
        session.user &&
        typeof token.sub === "string" &&
        typeof token.fullName === "string" &&
        typeof token.keycloakUserId === "string" &&
        typeof token.username === "string" &&
        (token.role === "admin" || token.role === "viewer")
      ) {
        session.user.id = token.sub;
        session.user.fullName = token.fullName;
        session.user.keycloakUserId = token.keycloakUserId;
        session.user.name = token.fullName;
        session.user.username = token.username;
        session.user.forcePasswordChange = false;
        session.user.role = token.role;
      }

      return session;
    },
  },
});
