# Rolling meal plan implementation

> For agent: REQUIRED SUB-SKILL: superpowers:executing-plans. Execute inline.

Goal: Persist a four or seven day plan beginning on any chosen date across devices.
Architecture: ISO calendar helpers, additive D1 metadata plus per-user active revision, ordered autosaves carrying metadata, date-aware engine and UI.
Tech stack: TypeScript, React, Cloudflare Pages/D1, node:test/SQLite, Playwright.
Spec: ../specs/2026-10-11-rolling-meal-plan-design.md

## Global constraints
Monday default; Today selects the Lisbon date. Selection does not relabel saved slots. No expiry or automatic rollover. Preserve per-user isolation. Active revision guards all writes including different weeks. Keep remains Share/Copy export. Production release separate.

## Review Focus
1. Destination-week writes before revision guard: API stale cross-week tests.
2. Metadata and items saved from different edits: sync delayed-write tests.
3. Sunday leftovers mapped to incorrect Monday: date/engine tests.
4. Draft controls changing the saved grid: browser smoke.
5. Migration choosing wrong legacy plan or losing empty plans: migration tests.

### Task 1: Calendar, storage and active API
Files: src/engine/planDates.ts, functions/api/plan.ts, schema.sql, migrations/0002_active_plan_dates.sql, scripts/plan-api.test.ts, scripts/plan-dates.test.ts.
Interfaces: planDates(start:string,days:number) -> {date:string,day_of_week:number}[]; active GET -> metadata/items/revision; POST active:true, start_date,plan_days,week_start,expected_revision,items.
1. Add failing real SQLite cross-week, validation, migration and calendar tests. Run npm test. Expected: new tests fail.
2. Implement helpers and guarded atomic storage. Run calendar/API tests. Expected: pass.
3. Commit calendar and active API.

### Task 2: Synchronization and generation
Files: src/lib/planSync.ts, src/lib/api.ts, src/store.tsx, src/engine/types.ts, src/engine/engine.ts, scripts/plan-sync.test.ts, scripts/plan-dates.test.ts.
Interfaces: snapshot adds start_date/plan_days; change(items,metadata?) queues whole plan; load() reads active plan; generate(days,startDate) maps relative weekdays.
1. Add failing no-rollover, competing cross-week, queued metadata, and Sunday engine tests. Run affected tests. Expected: failures.
2. Implement active hydration and dated generation. Run npm test. Expected: pass.
3. Commit synchronization and engine.

### Task 3: Controls, integration and verification
Files: src/pages/MealPlan.tsx, src/pages/Shop.tsx, functions/api/edit-plan.ts, src/styles.css, README.md, package.json.
Interfaces: selected controls are drafts; saved metadata renders grid. AI receives date range and returns only valid weekdays.
1. Add browser assertions for Sunday four-day grid, control changes retaining grid, reload on second device. Expected: old UI lacks date controls.
2. Implement controls and AI context. Verify npm test, npm run test:engine, npx tsc --noEmit, npm run build, two-profile browser smoke. Expected: all pass.
3. Commit, request whole-branch review, fix substantive findings with regression tests, update and push PR30.
