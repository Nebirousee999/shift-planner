CREATE TABLE "document_custom_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"file_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "director_name" varchar(255);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "inn" varchar(20);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "legal_address" varchar(500);--> statement-breakpoint
ALTER TABLE "document_custom_templates" ADD CONSTRAINT "document_custom_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;