UPDATE "users" SET "status_code" = 'non_active' WHERE "status_code" = 'inactive';
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_status_code_check" CHECK ("status_code" in ('active', 'non_active', 'expired', 'expiring_soon'));
