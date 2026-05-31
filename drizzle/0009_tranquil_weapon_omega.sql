DROP TABLE "users" CASCADE;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "username" text NOT NULL;--> statement-breakpoint
DROP TYPE "public"."user_role";