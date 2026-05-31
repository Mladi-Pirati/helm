ALTER TABLE "memberships" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "ended_at" timestamp with time zone;
