ALTER TABLE "mladi_pirati_membership_applications" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "mladi_pirati_membership_applications" ADD COLUMN "last_name" text;--> statement-breakpoint
UPDATE "mladi_pirati_membership_applications"
SET
  "first_name" = COALESCE(NULLIF(split_part(trim("full_name"), ' ', 1), ''), ''),
  "last_name" = CASE
    WHEN position(' ' IN trim("full_name")) > 0
      THEN btrim(substr(trim("full_name"), position(' ' IN trim("full_name")) + 1))
    ELSE ''
  END;--> statement-breakpoint
ALTER TABLE "mladi_pirati_membership_applications" ALTER COLUMN "first_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mladi_pirati_membership_applications" ALTER COLUMN "last_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mladi_pirati_membership_applications" DROP COLUMN "full_name";
