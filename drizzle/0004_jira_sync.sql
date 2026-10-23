CREATE TYPE "public"."sprint_state" AS ENUM('future', 'active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state" "sprint_state" NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"complete_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"key" text PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"status_category" text NOT NULL,
	"priority" text,
	"pod" text,
	"sprint_ids" integer[] DEFAULT '{}' NOT NULL,
	"assignee" jsonb,
	"dev_owners" jsonb NOT NULL,
	"epic_key" text,
	"epic_summary" text,
	"ready_for_production_date" date
);
