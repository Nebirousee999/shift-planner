ALTER TABLE "organizations" ADD COLUMN "tax_rate" numeric DEFAULT '13' NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_shifts" ADD COLUMN "is_unknown_absence" boolean DEFAULT false NOT NULL;