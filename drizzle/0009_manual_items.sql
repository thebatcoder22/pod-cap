CREATE TYPE "public"."manual_item_kind" AS ENUM('work', 'placeholder');--> statement-breakpoint
CREATE TABLE "manual_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"pod_id" integer NOT NULL,
	"sprint_id" integer NOT NULL,
	"person_id" integer,
	"kind" "manual_item_kind" NOT NULL,
	"title" text NOT NULL,
	"skill" "skill" NOT NULL,
	"days" numeric(4, 1) NOT NULL,
	"jira_key" text,
	CONSTRAINT "manual_items_half_days" CHECK ("manual_items"."days" > 0 and "manual_items"."days" * 2 = trunc("manual_items"."days" * 2)),
	CONSTRAINT "manual_items_key_on_placeholders" CHECK ("manual_items"."jira_key" is null or "manual_items"."kind" = 'placeholder')
);
--> statement-breakpoint
ALTER TABLE "manual_items" ADD CONSTRAINT "manual_items_pod_id_pods_id_fk" FOREIGN KEY ("pod_id") REFERENCES "public"."pods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_items" ADD CONSTRAINT "manual_items_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_items" ADD CONSTRAINT "manual_items_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;