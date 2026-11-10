
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "session_token" varchar(255) UNIQUE;

CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "sender" varchar(20) NOT NULL,
  "text" text NOT NULL,
  "images" text[],
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
  