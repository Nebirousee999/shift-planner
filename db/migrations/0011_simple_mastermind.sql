ALTER TABLE "sick_leaves" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sick_leaves" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sick_leaves" ADD COLUMN "updated_at" timestamp with time zone;