ALTER TABLE "organizations" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "tariff_id" varchar(20) DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "tariff_expires_at" timestamp;