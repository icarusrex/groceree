# Meal plans starting on any date

## Outcome

Groceree can generate four or seven consecutive days beginning on any selected date. Monday remains the default. A **Start from today** button selects today's date in Europe/Lisbon. Selecting Sunday, 11 October 2026 and four days produces Sunday 11, Monday 12, Tuesday 13 and Wednesday 14 October, in that order.

The selected date range, meals, leftover links and portions persist together in the existing cloud database. Laptop and tablet load the same active plan, including across a Monday boundary. This extends draft PR #30; its automatic saving, error handling, per-user isolation and stale-write protection remain required.

## User interaction

- Add a labelled start-date input beside the existing 4/7-day controls and a **Start from today** button.
- For a new planning session, the start-date input defaults to the Monday of the current Lisbon calendar week. Loading a saved plan displays its saved start date and duration.
- The Today button changes the selected date. **Generate plan** generates the replacement using the selected date and duration. Changing a control alone does not relabel or modify existing meals.
- Display the saved plan's complete date range and label each day with its weekday and date. Display exactly the selected consecutive days, including empty slots after removal.
- Date selection, generation and plan editing are unavailable until cloud hydration finishes, or while a stale-write conflict requires recovery.

Assumption: a saved plan remains visible until the user generates its replacement, with its dates clearly shown. There is no automatic reset on Monday or after the final meal date. This avoids losing access to the plan and shopping list merely because the date changes.

## Storage and identity

Reuse Cloudflare D1, the existing Cloudflare Access user identity and the meal-plan/item tables. Preserve existing rows and the existing possibility of additional users; add no registration or user switching.

Add `start_date` (ISO calendar date) and `plan_days` (4 or 7) to meal-plan metadata. Keep `week_start` as the Monday containing the plan's start date, for the existing weekly storage key and historical records. New records must have all three values consistent. An item's weekday remains 1=Monday through 7=Sunday. Since a plan spans at most seven days, each weekday/slot occurs at most once. Its actual meal date is derived from the saved start date and that weekday.

Add a per-user active-plan record containing the selected meal-plan ID and a monotonically increasing revision. This makes the selected plan independent of the device's current calendar week and protects concurrent replacements that choose different start weeks. Per-plan revisions alone cannot guard that cross-week replacement race.

When replacing a plan, select or update the existing meal-plan record for the selected start week, then make it active. Existing older rows are retained. Retain the one-record-per-user/start-week convention; generating a second range within that same start week replaces that week's record.

## Compatibility and migration

Provide additive SQL migrations for both a fresh database and the existing deployment. PR #30's revision-column migration is still required on production; the new migration follows it. No reseeding or destructive table rebuild is required.

Initialize each user's active pointer from their most recent existing cloud plan, ordered by `week_start` and then ID. Legacy plans receive their stored Monday as `start_date`. Infer their duration as seven days when any saved meal occupies Friday through Sunday, otherwise use four days; for a saved empty plan use that user's current 4/7-day setting, defaulting to four. Preserve an intentionally empty cloud plan as an existing plan.

A legacy browser-only plan is eligible for import only when the user has no existing active cloud plan. Import it with the current Monday and its inferred duration. A cloud plan takes precedence, and the old browser key is removed only after cloud acknowledgement. Corrupt browser data cannot crash startup.

## API and synchronization

Extend `/api/plan` with an active-plan read mode. Return the saved plan ID, weekly key, actual start date, duration, items and active revision in one consistent database snapshot. Exact-week reads can remain available for compatibility and tests, but normal application hydration uses the active plan.

Active writes carry the revision the client last loaded, the selected start date, duration and complete item set. An absent active plan has an explicit creation precondition. The server validates real calendar dates, duration, weekly-key consistency, slot uniqueness and membership in the chosen range, recipe IDs, positive servings and valid leftover references.

The active-plan revision comparison, meal-plan metadata, slot replacement and active-pointer update run in one transaction. A stale write, including a race between different selected start weeks or a first import, returns a conflict and changes no plan or pointer. Avoid unchecked writes to a destination week before verifying the active revision.

Within a device, writes remain serialized. Unsaved edits stay visible on failures. Retry resumes the failed operation. Explicit **Load cloud plan** discards that device's unsaved edits and loads the active cloud record; a failed load remembers that operation so retry/reconnect can finish it.

Startup, focus, visibility changes and the existing visible-page interval refresh the active plan. Crossing Monday does not switch the active plan or reset its meals. A late refresh cannot erase an edit made after the refresh began. Changing the generation date while another write is pending must queue the replacement without applying the wrong plan metadata to either request.

## Generation, editing and shopping

The generator builds a relative sequence of days and maps that sequence to actual weekdays from the selected start date. Preserve recipe selection, diet filtering, variety and budget behavior. Use the start date's month for seasonality. Four days starting Sunday are ordered Sunday, Monday, Tuesday and Wednesday rather than sorted by weekday number.

Leftover links use the actual source weekday, including Sunday dinner to Monday lunch. Recalculate portions from those links after generation and every edit. Do not infer a previous-day leftover using simple weekday subtraction across Sunday/Monday.

Render and edit only slots in the saved date range. Give AI editing the dated, chronological range and accept changes only to its included weekdays. Recipe replacement and manual removal retain date-range metadata. The shopping list derives from all meals in this active range and continues to exclude duplicate leftover ingredients.

Existing receipt totals remain calendar-week/month totals. The plan cost covers its selected date range. This change does not redefine receipt accounting or add automatic Google Keep synchronization. The existing Share/Copy export remains available for Keep.

## Verification

- Monday four-day and seven-day generation retain their existing behavior.
- Sunday four-day generation produces Sunday through Wednesday, with correct dates and order.
- Other start weekdays, year/month boundaries and Lisbon daylight-saving transitions produce the correct consecutive calendar dates.
- Sunday-dinner leftovers link to Monday lunch and retain their portions after a cloud round trip.
- Saved duration stays fixed when generation controls are changed without generating.
- A saved Sunday-to-Wednesday plan remains the active plan on Monday on a fresh second device.
- Concurrent device replacements targeting different start weeks reject the stale replacement atomically.
- Failed saves, failed explicit cloud loads, rapid edits and late refreshes preserve the existing recovery guarantees.
- Existing non-empty and intentionally empty cloud plans migrate without losing data; browser imports cannot replace them.
- Invalid dates, duration, out-of-range slots and leftover sources are rejected without mutating the active plan.
- Browser verification covers date selection, Today, generation, date labels, editing, shopping and independent device sessions.
- Run the complete behavioral suite, type checks, production build and existing engine smoke test. Review the finished change before updating PR #30.

## Release

Update PR #30 around the final combined cloud-sync and flexible-start behavior. Document the additive migrations and apply them before production code is deployed. Production merge and deployment remain a separate decision; the previous request to implement the date option did not approve the earlier pending live release.
