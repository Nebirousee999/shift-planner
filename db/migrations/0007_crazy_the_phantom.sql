CREATE TYPE "public"."shift_change_kind" AS ENUM('UPDATE', 'CREATE');--> statement-breakpoint
ALTER TABLE "shift_change_requests" ALTER COLUMN "shift_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_change_requests" ADD COLUMN "kind" "shift_change_kind" DEFAULT 'UPDATE' NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_change_requests" ADD COLUMN "week_id" uuid;--> statement-breakpoint
ALTER TABLE "shift_change_requests" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_week_id_schedule_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."schedule_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_template_id_shift_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."shift_templates"("id") ON DELETE set null ON UPDATE no action;