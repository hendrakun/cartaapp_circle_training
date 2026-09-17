-- Vendor area revision 5: reference masters, fixed document slots, BIM answers and per-aspect reviews.
-- vendor_documents must be empty: the new requirement_id column is NOT NULL and doc_type is dropped.
-- The reference masters are seeded by scripts/seed-vendor-masters.ts after this migration.
CREATE TABLE "bim_answers" (
	"id" text PRIMARY KEY,
	"vendor_id" text NOT NULL,
	"question_id" text NOT NULL,
	"answer" boolean NOT NULL,
	"note" text,
	"file_key" text,
	"file_name" text,
	"mime_type" text,
	"file_size" integer,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_business_classifications" (
	"vendor_id" text,
	"classification_id" text,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_business_classifications_pkey" PRIMARY KEY("vendor_id","classification_id")
);
--> statement-breakpoint
CREATE TABLE "vendor_reviews" (
	"id" text PRIMARY KEY,
	"vendor_id" text NOT NULL,
	"aspect" text NOT NULL,
	"decision" text NOT NULL,
	"note" text,
	"reviewer_user_id" text NOT NULL,
	"reviewed_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_reviews_aspect_check" CHECK ("aspect" in ('legal', 'finance', 'technical', 'bim')),
	CONSTRAINT "vendor_reviews_decision_check" CHECK ("decision" in ('approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "approval_divisions" (
	"code" text PRIMARY KEY,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bim_questions" (
	"id" text PRIMARY KEY,
	"question" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_classifications" (
	"id" text PRIMARY KEY,
	"business_field" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "business_classifications_field_check" CHECK ("business_field" in ('subkon', 'supplier', 'jasa'))
);
--> statement-breakpoint
CREATE TABLE "vendor_document_requirements" (
	"id" text PRIMARY KEY,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"required" boolean DEFAULT true NOT NULL,
	"applies_to_foreign" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "vendor_document_requirements_category_check" CHECK ("category" in ('legal', 'finance', 'technical'))
);
--> statement-breakpoint
ALTER TABLE "vendor_documents" ADD COLUMN "requirement_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "qualification" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "coverage" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "approval_division_code" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "vendor_documents" DROP COLUMN "doc_type";--> statement-breakpoint
CREATE UNIQUE INDEX "bim_answers_question_idx" ON "bim_answers" ("vendor_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_documents_slot_idx" ON "vendor_documents" ("vendor_id","requirement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_reviews_aspect_idx" ON "vendor_reviews" ("vendor_id","aspect");--> statement-breakpoint
CREATE INDEX "business_classifications_field_name_idx" ON "business_classifications" ("business_field","name");--> statement-breakpoint
CREATE INDEX "vendor_document_requirements_category_idx" ON "vendor_document_requirements" ("category","sort_order");--> statement-breakpoint
ALTER TABLE "bim_answers" ADD CONSTRAINT "bim_answers_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bim_answers" ADD CONSTRAINT "bim_answers_question_id_bim_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "bim_questions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "bim_answers" ADD CONSTRAINT "bim_answers_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "bim_answers" ADD CONSTRAINT "bim_answers_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "vendor_business_classifications" ADD CONSTRAINT "vendor_business_classifications_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "vendor_business_classifications" ADD CONSTRAINT "vendor_business_classifications_xuoZsNxCQS61_fkey" FOREIGN KEY ("classification_id") REFERENCES "business_classifications"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "vendor_business_classifications" ADD CONSTRAINT "vendor_business_classifications_U1ZLY5l7M8XX_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "vendor_business_classifications" ADD CONSTRAINT "vendor_business_classifications_C50PsknSDR1a_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_kD8QQkQ3Asuv_fkey" FOREIGN KEY ("requirement_id") REFERENCES "vendor_document_requirements"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_reviewer_user_id_users_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_approval_division_code_approval_divisions_code_fkey" FOREIGN KEY ("approval_division_code") REFERENCES "approval_divisions"("code") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_qualification_check" CHECK ("qualification" is null or "qualification" in ('mikro', 'kecil', 'menengah', 'besar'));--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_coverage_check" CHECK ("coverage" is null or "coverage" in ('lokal', 'regional', 'nasional', 'internasional'));