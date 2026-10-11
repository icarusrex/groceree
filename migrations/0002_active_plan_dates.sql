ALTER TABLE meal_plans ADD COLUMN start_date TEXT;
ALTER TABLE meal_plans ADD COLUMN plan_days INTEGER NOT NULL DEFAULT 4;
UPDATE meal_plans SET start_date=week_start, plan_days=CASE
  WHEN EXISTS(SELECT 1 FROM meal_plan_items i WHERE i.plan_id=meal_plans.id AND i.day_of_week>=5) THEN 7
  WHEN EXISTS(SELECT 1 FROM meal_plan_items i WHERE i.plan_id=meal_plans.id) THEN 4
  WHEN COALESCE((SELECT plan_days FROM user_settings s WHERE s.user_id=meal_plans.user_id),4)=7 THEN 7 ELSE 4 END;
CREATE TABLE active_meal_plans (
  user_id TEXT PRIMARY KEY,
  plan_id INTEGER REFERENCES meal_plans(id),
  revision INTEGER NOT NULL DEFAULT 0
);
INSERT INTO active_meal_plans(user_id,plan_id,revision)
SELECT p.user_id,p.id,1 FROM meal_plans p WHERE p.id=(
  SELECT latest.id FROM meal_plans latest WHERE latest.user_id=p.user_id
  ORDER BY latest.week_start DESC,latest.id DESC LIMIT 1
);
