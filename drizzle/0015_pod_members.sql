ALTER TYPE "public"."skill" ADD VALUE 'DevOps';--> statement-breakpoint
CREATE TABLE "pod_members" (
	"pod_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"share" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "pod_members_pod_id_person_id_pk" PRIMARY KEY("pod_id","person_id"),
	CONSTRAINT "pod_members_share_range" CHECK ("pod_members"."share" between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "people" DROP CONSTRAINT "people_active_in_a_pod";--> statement-breakpoint
ALTER TABLE "people" DROP CONSTRAINT "people_pod_id_pods_id_fk";
--> statement-breakpoint
ALTER TABLE "pod_members" ADD CONSTRAINT "pod_members_pod_id_pods_id_fk" FOREIGN KEY ("pod_id") REFERENCES "public"."pods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pod_members" ADD CONSTRAINT "pod_members_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Everyone keeps their one pod, with all of their capacity in it.
INSERT INTO "pod_members" ("pod_id", "person_id") SELECT "pod_id", "id" FROM "people" WHERE "pod_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN "pod_id";