ALTER TABLE "sick_leaves" ADD COLUMN "created_by_id" uuid;--> statement-breakpoint
ALTER TABLE "sick_leaves" ADD COLUMN "updated_by_id" uuid;--> statement-breakpoint
ALTER TABLE "sick_leaves" ADD CONSTRAINT "sick_leaves_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sick_leaves" ADD CONSTRAINT "sick_leaves_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;