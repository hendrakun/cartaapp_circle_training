CREATE TABLE "vendor_contacts" (
	"id" text PRIMARY KEY,
	"vendor_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"phone" text,
	"email" text,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_documents" (
	"id" text PRIMARY KEY,
	"vendor_id" text NOT NULL,
	"doc_type" text NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"file_size" integer,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY,
	"owner_user_id" text NOT NULL,
	"company_name" text NOT NULL,
	"company_type" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"npwp" text UNIQUE,
	"tax_id" text,
	"business_field" text NOT NULL,
	"address" text,
	"province" text,
	"city" text,
	"district" text,
	"village" text,
	"postal_code" text,
	"phone" text,
	"status_code" text DEFAULT 'registered' NOT NULL,
	"email_verified_at" timestamp,
	"verification_token" text UNIQUE,
	"submitted_at" timestamp,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp,
	"review_note" text,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_status_code_check" CHECK ("status_code" in ('registered', 'email_verified', 'profile_complete', 'submitted', 'approved', 'rejected')),
	CONSTRAINT "vendors_company_type_check" CHECK ("company_type" in ('pt', 'cv', 'firma', 'yayasan', 'koperasi', 'but', 'foreign_company', 'foreign_individual', 'other')),
	CONSTRAINT "vendors_business_field_check" CHECK ("business_field" in ('subkon', 'supplier', 'jasa'))
);
--> statement-breakpoint
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_owner_user_id_users_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_reviewed_by_user_id_users_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id");