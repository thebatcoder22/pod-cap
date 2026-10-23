CREATE TYPE "public"."skill" AS ENUM('FE', 'BE', 'Data', 'AI');--> statement-breakpoint
CREATE TABLE "allowlist" (
	"email" text PRIMARY KEY NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"jira_account_id" text,
	"pod_id" integer,
	"main_skill" "skill" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "people_email_unique" UNIQUE("email"),
	CONSTRAINT "people_jira_account_id_unique" UNIQUE("jira_account_id")
);
--> statement-breakpoint
CREATE TABLE "pods" (
	"id" serial PRIMARY KEY NOT NULL,
	"jira_pod_value" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"lead_person_id" integer,
	CONSTRAINT "pods_jira_pod_value_unique" UNIQUE("jira_pod_value"),
	CONSTRAINT "pods_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_pod_id_pods_id_fk" FOREIGN KEY ("pod_id") REFERENCES "public"."pods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_lead_person_id_people_id_fk" FOREIGN KEY ("lead_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;