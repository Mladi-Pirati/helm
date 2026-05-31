ALTER TABLE "mladi_pirati_membership_applications" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "mladi_pirati_membership_applications" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint
UPDATE "mladi_pirati_membership_applications"
SET "status" = CASE
	WHEN "status" IN ('new', 'in_review') THEN 'pending'
	ELSE "status"
END;--> statement-breakpoint
DROP TYPE "public"."membership_application_status";--> statement-breakpoint
CREATE TYPE "public"."membership_application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "mladi_pirati_membership_applications" ALTER COLUMN "status" SET DATA TYPE "public"."membership_application_status" USING "status"::"public"."membership_application_status";--> statement-breakpoint
ALTER TABLE "mladi_pirati_membership_applications" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."membership_application_status";--> statement-breakpoint
ALTER TABLE "mladi_pirati_membership_applications" ADD COLUMN "rejection_reason" text;
