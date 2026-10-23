CREATE TYPE "public"."snapshot_kind" AS ENUM('start', 'close');--> statement-breakpoint
CREATE TABLE "snapshots" (
	"pod_id" integer NOT NULL,
	"sprint_id" integer NOT NULL,
	"sprint_name" text NOT NULL,
	"sprint_start_date" timestamp with time zone,
	"sprint_end_date" timestamp with time zone,
	"kind" "snapshot_kind" NOT NULL,
	"skill" "skill" NOT NULL,
	"capacity" numeric(6, 2) NOT NULL,
	"committed" numeric(6, 2),
	"completed" numeric(6, 2),
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshots_pod_id_sprint_id_kind_skill_pk" PRIMARY KEY("pod_id","sprint_id","kind","skill")
);
--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_pod_id_pods_id_fk" FOREIGN KEY ("pod_id") REFERENCES "public"."pods"("id") ON DELETE no action ON UPDATE no action;