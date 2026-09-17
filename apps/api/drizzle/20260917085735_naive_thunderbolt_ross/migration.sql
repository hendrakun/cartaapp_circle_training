-- Username becomes a required unique registration field (design revision 4).
-- Add it nullable, backfill existing registrations with a value derived from
-- their primary key, then require it.
ALTER TABLE "vendors" ADD COLUMN "username" text;--> statement-breakpoint
UPDATE "vendors" SET "username" = 'vendor-' || left(replace("id", '-', ''), 12) WHERE "username" IS NULL;--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_username_key" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_username_check" CHECK ("username" ~ '^[A-Za-z0-9._-]{3,160}$');--> statement-breakpoint
-- NPWP is exactly 16 digits (design revision 4). A stored value with another
-- length must be corrected before this migration runs.
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_npwp_check" CHECK ("npwp" is null or "npwp" ~ '^[0-9]{16}$');
