ALTER TABLE "pods" DROP CONSTRAINT "pods_jira_pod_value_unique";--> statement-breakpoint
ALTER TABLE "epics" ADD COLUMN "pod_option_id" text;--> statement-breakpoint
ALTER TABLE "pods" ADD COLUMN "jira_pod_option_id" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "pod_option_id" text;--> statement-breakpoint
ALTER TABLE "pods" ADD CONSTRAINT "pods_jira_pod_option_id_unique" UNIQUE("jira_pod_option_id");--> statement-breakpoint
-- Jira's POD option ids. The two RoadMap labels carry the lead's name, which is why pods match on ids now.
UPDATE "pods" SET "jira_pod_option_id" = '11231', "jira_pod_value" = 'RoadMap 1-Shikar' WHERE "slug" = 'roadmap-1';--> statement-breakpoint
UPDATE "pods" SET "jira_pod_option_id" = '11232', "jira_pod_value" = 'RoadMap 2-Aman' WHERE "slug" = 'roadmap-2';--> statement-breakpoint
UPDATE "pods" SET "jira_pod_option_id" = '11230' WHERE "slug" = 'velocity';--> statement-breakpoint
UPDATE "pods" SET "jira_pod_option_id" = '11229' WHERE "slug" = 'atlas';--> statement-breakpoint
-- Synced rows keep working until the next sync rewrites them.
UPDATE "tickets" SET "pod_option_id" = CASE "pod"
  WHEN 'Atlas' THEN '11229' WHEN 'Velocity' THEN '11230' WHEN 'RoadMap 1-Shikar' THEN '11231'
  WHEN 'RoadMap 2-Aman' THEN '11232' WHEN 'Support' THEN '11265' END;--> statement-breakpoint
UPDATE "epics" SET "pod_option_id" = CASE "pod"
  WHEN 'Atlas' THEN '11229' WHEN 'Velocity' THEN '11230' WHEN 'RoadMap 1-Shikar' THEN '11231'
  WHEN 'RoadMap 2-Aman' THEN '11232' WHEN 'Support' THEN '11265' END;
