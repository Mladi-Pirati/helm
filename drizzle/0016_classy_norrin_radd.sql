ALTER TABLE "members" ADD COLUMN "full_legal_name" text;--> statement-breakpoint
UPDATE "members" SET "full_legal_name" = TRIM(first_name || ' ' || last_name);--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "full_legal_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mladi_pirati_membership_applications" ADD COLUMN "full_legal_name" text;--> statement-breakpoint
UPDATE "mladi_pirati_membership_applications" SET "full_legal_name" = TRIM(first_name || ' ' || last_name);--> statement-breakpoint
ALTER TABLE "mladi_pirati_membership_applications" ALTER COLUMN "full_legal_name" SET NOT NULL;
