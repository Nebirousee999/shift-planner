ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "max_bot_link" varchar(255);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "max_bot_token" varchar(255);