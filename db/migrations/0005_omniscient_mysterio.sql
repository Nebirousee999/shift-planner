CREATE TYPE "public"."vacation_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
ALTER TABLE "vacations" ADD COLUMN "status" "vacation_status" DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
ALTER TABLE "vacations" ADD COLUMN "previous_start_date" date;--> statement-breakpoint
ALTER TABLE "vacations" ADD COLUMN "previous_end_date" date;--> statement-breakpoint
ALTER TABLE "vacations" ADD COLUMN "previous_comment" varchar(255);--> statement-breakpoint
ALTER TABLE "vacations" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "vacations" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "vacations" ADD CONSTRAINT "vacations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;