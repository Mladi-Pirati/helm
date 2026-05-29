CREATE TYPE "public"."member_creation_status" AS ENUM('success', 'fail');--> statement-breakpoint
ALTER TABLE "mladi_pirati_membership_applications" ADD COLUMN "member_creation_status" "member_creation_status";
