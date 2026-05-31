import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { members, memberRoles, roles } from "@/db/schema";
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

function getNamePartsFromProfile(profile: unknown): {
  firstName: string;
  lastName: string;
} {
  const parsed = z
    .object({
      given_name: z.string().optional(),
      family_name: z.string().optional(),
      name: z.string().optional(),
    })
    .passthrough()
    .safeParse(profile);

  if (!parsed.success) {
    return { firstName: "", lastName: "" };
  }

  const givenName = parsed.data.given_name?.trim();
  const familyName = parsed.data.family_name?.trim();

  if (givenName && familyName) {
    return { firstName: givenName, lastName: familyName };
  }

  const fullName = parsed.data.name?.trim();
  if (fullName) {
    const parts = fullName.split(/\s+/);
    return {
      firstName: givenName || parts[0] || "",
      lastName: familyName || parts.slice(1).join(" ") || "",
    };
  }

  return {
    firstName: givenName || "",
    lastName: familyName || "",
  };
}

async function getSessionUserByKeycloakUserId(keycloakUserId: string) {
  return db.query.members.findFirst({
    where: eq(members.keycloakId, keycloakUserId),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      keycloakId: true,
      username: true,
    },
  });
}

async function hasKeycloakManagedMembers() {
  const rows = await db
    .select({
      id: members.id,
    })
    .from(members)
    .where(isNotNull(members.keycloakId))
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

async function assignSuperadminRole(memberId: string) {
  const superadminRole = await db.query.roles.findFirst({
    where: eq(roles.key, "superadmin"),
  });

  if (!superadminRole) {
    return;
  }

  await db.insert(memberRoles).values({
    memberId,
    roleId: superadminRole.id,
    grantedBy: null,
  });
}

async function ensureLocalUserForSignIn(profile: unknown, accessToken: unknown) {
  const parsedProfile = keycloakProfileSchema.safeParse(profile);

  if (!parsedProfile.success || !hasClientRole(profile, accessToken)) {
    return false;
  }

  const existingMember = await getSessionUserByKeycloakUserId(
    parsedProfile.data.sub,
  );

  if (existingMember) {
    return true;
  }

  if (await hasKeycloakManagedMembers()) {
    return false;
  }

  const username =
    getKeycloakUsernameFromProfile(profile) ?? parsedProfile.data.sub;
  const { firstName, lastName } = getNamePartsFromProfile(profile);
  const existingUsernameMember = await db.query.members.findFirst({
    where: eq(members.username, username),
    columns: {
      id: true,
    },
  });

  if (existingUsernameMember) {
    await db
      .update(members)
      .set({
        firstName: firstName || username,
        lastName: lastName || "",
        keycloakId: parsedProfile.data.sub,
        username,
      })
      .where(eq(members.id, existingUsernameMember.id));

    await assignSuperadminRole(existingUsernameMember.id);

    return true;
  }

  const [newMember] = await db
    .insert(members)
    .values({
      firstName: firstName || username,
      lastName: lastName || "",
      keycloakId: parsedProfile.data.sub,
      username,
    })
    .returning({ id: members.id });

  if (newMember) {
    await assignSuperadminRole(newMember.id);
  }

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
        const currentMember = await getSessionUserByKeycloakUserId(
          token.keycloakUserId,
        );

        if (!currentMember) {
          return null;
        }

        const fullName = `${currentMember.firstName} ${currentMember.lastName}`.trim();
        token.sub = currentMember.id;
        token.fullName = fullName;
        token.keycloakUserId = currentMember.keycloakId;
        token.name = fullName;
        token.username = currentMember.username;
      }

      return token;
    },
    async session({ session, token }) {
      if (
        session.user &&
        typeof token.sub === "string" &&
        typeof token.fullName === "string" &&
        typeof token.keycloakUserId === "string" &&
        typeof token.username === "string"
      ) {
        session.user.id = token.sub;
        session.user.fullName = token.fullName;
        session.user.keycloakUserId = token.keycloakUserId;
        session.user.name = token.fullName;
        session.user.username = token.username;
      }

      return session;
    },
  },
});
