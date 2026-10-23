CREATE TABLE "proficiencies" (
	"person_id" integer NOT NULL,
	"skill" "skill" NOT NULL,
	"percent" integer NOT NULL,
	CONSTRAINT "proficiencies_person_id_skill_pk" PRIMARY KEY("person_id","skill"),
	CONSTRAINT "proficiencies_percent_range" CHECK ("proficiencies"."percent" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "proficiencies" ADD CONSTRAINT "proficiencies_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;