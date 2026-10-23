CREATE TYPE "public"."tshirt_size" AS ENUM('S', 'M', 'L', 'XL');--> statement-breakpoint
CREATE TABLE "epic_sizes" (
	"epic_key" text PRIMARY KEY NOT NULL,
	"size" "tshirt_size" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "epics" (
	"key" text PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"status" text NOT NULL,
	"status_category" text NOT NULL,
	"pod" text,
	"ready_for_production_date" date
);
