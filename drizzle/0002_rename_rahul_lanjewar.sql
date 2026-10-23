-- Already-seeded databases keep the old name, since seeding only runs on an empty database.
UPDATE "people" SET "name" = 'Rahul Lanjewar' WHERE "name" = 'Rahul Ritesh Lanjewar';
