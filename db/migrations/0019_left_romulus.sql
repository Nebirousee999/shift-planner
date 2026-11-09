ALTER TABLE "organizations" ADD COLUMN "max_bot_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;