CREATE TABLE "legalizirajmo_si_newsletter_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "legalizirajmo_si_newsletter_subscriptions_email_unique" ON "legalizirajmo_si_newsletter_subscriptions" USING btree (lower("email"));