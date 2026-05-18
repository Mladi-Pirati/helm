CREATE TABLE "newsletter_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"newsletter_id" text NOT NULL,
	"email" text NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletters" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "newsletters" (
	"id",
	"name",
	"slug",
	"description",
	"created_at",
	"updated_at"
) VALUES (
	'legalizirajmo-si',
	'legalizirajmo.si',
	'legalizirajmo-si',
	'Newsletter signups collected from legalizirajmo.si.',
	now(),
	now()
);
--> statement-breakpoint
INSERT INTO "newsletter_subscriptions" (
	"id",
	"newsletter_id",
	"email",
	"raw_payload",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	'legalizirajmo-si',
	"email",
	"raw_payload",
	"created_at",
	"updated_at"
FROM "legalizirajmo_si_newsletter_subscriptions";
--> statement-breakpoint
DROP TABLE "legalizirajmo_si_newsletter_subscriptions" CASCADE;--> statement-breakpoint
ALTER TABLE "newsletter_subscriptions" ADD CONSTRAINT "newsletter_subscriptions_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_subscriptions_email_unique" ON "newsletter_subscriptions" USING btree ("newsletter_id",lower("email"));--> statement-breakpoint
CREATE INDEX "newsletter_subscriptions_newsletter_id_idx" ON "newsletter_subscriptions" USING btree ("newsletter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletters_slug_unique" ON "newsletters" USING btree (lower("slug"));
