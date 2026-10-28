CREATE TYPE "public"."employment_type" AS ENUM('GPH', 'SHTAT');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('HOURLY', 'MONTHLY');--> statement-breakpoint
ALTER TABLE "scheduled_shifts" ADD COLUMN "is_no_show" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payment_type" "payment_type" DEFAULT 'HOURLY' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "employment_type" "employment_type" DEFAULT 'SHTAT' NOT NULL;