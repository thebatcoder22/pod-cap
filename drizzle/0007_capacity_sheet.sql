CREATE TABLE "holidays" (
	"date" date PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave" (
	"person_id" integer NOT NULL,
	"sprint_id" integer NOT NULL,
	"days" numeric(3, 1) NOT NULL,
	CONSTRAINT "leave_person_id_sprint_id_pk" PRIMARY KEY("person_id","sprint_id"),
	CONSTRAINT "leave_half_days" CHECK ("leave"."days" > 0 and "leave"."days" * 2 = trunc("leave"."days" * 2))
);
--> statement-breakpoint
CREATE TABLE "planning_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"focus_percent" integer NOT NULL,
	CONSTRAINT "planning_settings_single_row" CHECK ("planning_settings"."id" = 1),
	CONSTRAINT "planning_settings_focus_range" CHECK ("planning_settings"."focus_percent" between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave" ADD CONSTRAINT "leave_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;