-- Apply once to an existing D1 database before deploying the cloud-plan client.
ALTER TABLE meal_plans ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
