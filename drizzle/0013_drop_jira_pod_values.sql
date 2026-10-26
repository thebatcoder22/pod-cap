ALTER TABLE "pods" ALTER COLUMN "jira_pod_option_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "epics" DROP COLUMN "pod";--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "pod";