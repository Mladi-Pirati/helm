import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { membershipApplicationStatuses } from "@/lib/membership-applications";

export const USER_ROLES = ["admin", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type { MembershipApplicationStatus } from "@/lib/membership-applications";

export const MEMBERSHIP_APPLICATION_STATUSES = membershipApplicationStatuses;

export const userRoleEnum = pgEnum("user_role", USER_ROLES);
export const membershipApplicationStatusEnum = pgEnum(
  "membership_application_status",
  MEMBERSHIP_APPLICATION_STATUSES,
);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    fullName: text("full_name").notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    forcePasswordChange: boolean("force_password_change")
      .notNull()
      .default(true),
    role: userRoleEnum("role").notNull().default("viewer"),
    ...timestamps,
  },
  (table) => ({
    usernameUniqueIndex: uniqueIndex("users_username_unique").on(
      table.username,
    ),
  }),
);

export const mladiPiratiMembershipApplications = pgTable(
  "mladi_pirati_membership_applications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    fullName: text("full_name").notNull(),
    dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
    placeOfBirth: text("place_of_birth").notNull(),
    streetAddress: text("street_address").notNull(),
    cityAndPostalCode: text("city_and_postal_code").notNull(),
    residenceRegion: text("residence_region").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    participationMode: text("participation_mode").notNull(),
    discordUsername: text("discord_username"),
    motivation: text("motivation"),
    consentsToDataProcessing: boolean("consents_to_data_processing")
      .notNull(),
    acceptsStatuteAndProgram: boolean("accepts_statute_and_program")
      .notNull(),
    status: membershipApplicationStatusEnum("status").notNull().default("new"),
    rawPayload: jsonb("raw_payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
);

export const legalizirajmoSiNewsletterSubscriptions = pgTable(
  "legalizirajmo_si_newsletter_subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    rawPayload: jsonb("raw_payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => ({
    emailUniqueIndex: uniqueIndex(
      "legalizirajmo_si_newsletter_subscriptions_email_unique",
    ).on(sql`lower(${table.email})`),
  }),
);

export const apiRateLimitWindows = pgTable(
  "api_rate_limit_windows",
  {
    scope: text("scope").notNull(),
    identifierHash: text("identifier_hash").notNull(),
    windowStart: timestamp("window_start", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.scope, table.identifierHash, table.windowStart],
      name: "api_rate_limit_windows_pkey",
    }),
    expiresAtIndex: index("api_rate_limit_windows_expires_at_idx").on(
      table.expiresAt,
    ),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type MembershipApplication =
  typeof mladiPiratiMembershipApplications.$inferSelect;
export type NewMembershipApplication =
  typeof mladiPiratiMembershipApplications.$inferInsert;
export type LegalizirajmoSiNewsletterSubscription =
  typeof legalizirajmoSiNewsletterSubscriptions.$inferSelect;
export type NewLegalizirajmoSiNewsletterSubscription =
  typeof legalizirajmoSiNewsletterSubscriptions.$inferInsert;
export type ApiRateLimitWindow = typeof apiRateLimitWindows.$inferSelect;
export type NewApiRateLimitWindow = typeof apiRateLimitWindows.$inferInsert;
