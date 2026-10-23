-- Already-seeded databases get the new Velocity members. On an empty database the seed adds them instead.
INSERT INTO "people" ("name", "main_skill", "pod_id")
SELECT v.name, v.skill::skill, p.id
FROM (VALUES ('Shadab Anjum', 'FE'), ('Nanagoud', 'BE')) AS v(name, skill)
JOIN "pods" p ON p.jira_pod_value = 'Velocity'
WHERE NOT EXISTS (SELECT 1 FROM "people" x WHERE x.name = v.name);
