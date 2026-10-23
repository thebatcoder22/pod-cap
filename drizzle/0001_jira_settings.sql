CREATE TABLE "jira_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"site" text NOT NULL,
	"email" text NOT NULL,
	"token_ciphertext" text NOT NULL,
	"token_updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "jira_settings_single_row" CHECK ("jira_settings"."id" = 1)
);
