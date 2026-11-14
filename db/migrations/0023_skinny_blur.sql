CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"sender" varchar(20) NOT NULL,
	"text" text NOT NULL,
	"images" text[],
	"is_read_by_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "session_token" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "color" varchar(7) DEFAULT '#3B82F6' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "message";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "images";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "reply";--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_session_token_unique" UNIQUE("session_token");