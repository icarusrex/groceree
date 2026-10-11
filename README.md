# Groceree — meal planner on Cloudflare

React + Cloudflare Pages (static app **and** serverless Functions) + D1 (SQLite) +
Cloudflare Access (login gate). The plan engine runs in the browser; Functions only
persist data to D1 and proxy Gemini for flyer parsing. **Hosting is free** — you pay
Google only for occasional Gemini calls.

```
src/            React app
  data/         seasonality.pt.ts, cost_tiers.ts   (engine inputs)
  engine/       engine.ts, types.ts                (scoring + plan generation)
  pages/        MealPlan, Shop, Pantry, Settings
functions/api/  recipes, settings, state, pantry, plan, parse-flyer  (Pages Functions)
schema.sql      D1 schema
seed/           recipes.seed.json  + generated seed.sql (455 recipes)
scripts/        build_seed_sql.mjs, test_engine.ts
```

## Prerequisites
- Node 18+ and a Cloudflare account.
- `groceree.store` added to your Cloudflare account (DNS managed by Cloudflare).
- A Gemini API key from aistudio.google.com (only needed for flyer parsing).

## 1. Install
```bash
npm install
npx wrangler login
```

## 2. Create the database and seed it
```bash
npx wrangler d1 create groceree
# copy the printed database_id into wrangler.toml (database_id = "...")

npm run db:seed:remote   # applies schema.sql + the 455-recipe seed to the remote D1
```
For local development instead: `npm run db:seed:local`.

## 3. Add the Gemini key (server-side only — never in the app)
```bash
npx wrangler pages secret put GEMINI_API_KEY     # paste your key when prompted
```
For local dev, copy `.dev.vars.example` to `.dev.vars` and put the key there
(`.dev.vars` is gitignored and never shipped).

## 3b. Shopping list to the phone
The Shopping List has two buttons, no config or secrets needed:
- **→ Obsidian** writes the unticked items as a `- [ ]` checklist to
  `04-personal/Meal Plan/Shopping list.md` in the `vault` vault (constants at the
  top of `src/pages/Shop.tsx`), via Obsidian's `obsidian://new` URI. It
  overwrites that note each time; Syncthing carries it to the phone.
- **Share… / Copy** opens the phone's share sheet (Keep, messages…) or copies
  the same checklist to the clipboard on desktop.

## 4. Run locally
```bash
npm run dev        # UI only (fast), API calls need the line below
npm run preview    # full stack: builds, serves app + Functions + local D1
```

Tests use Node 24+ (native TypeScript support and SQLite): `npm test`.
Run `npm run test:engine` for the existing planner smoke test and `npx tsc --noEmit`
to check types.

## Meal plan sync and dates
Settings and the active meal plan persist in D1. Generation, manual and AI edits,
recipe replacements and slot removal save automatically. The cloud status shows
saving, saved, errors and conflicts. Save waits for acknowledgement.

Choose four or seven consecutive days and any start date. The default is Monday
in Europe/Lisbon; **Start from today** selects today's Lisbon date. Press
**Generate plan** to replace the plan with those dates. Changing controls alone
does not change the saved grid or shopping list. Each saved date appears even
when its meal slots are empty. Sunday starts continue through Monday correctly.
The active plan stays visible until replaced, including after its end date.

The app checks for cloud changes on focus, visibility and every visible minute.
An old browser localStorage.plan imports once only if no active cloud plan exists.
Existing cloud plans win, including deliberately empty ones. Open the device
holding the old browser plan first if it has never been saved.

Writes include the date range and a per-user active revision, so stale devices
cannot overwrite newer plans even across different calendar weeks. **Load cloud
plan** discards unsaved local edits. **Retry** saves failed edits when connected;
keep the tab open until saving succeeds. Older calendar-week records remain in
D1; replacing a plan within the same start week updates that record.

Existing user_id scoping remains. Single-user access uses the same Cloudflare
Access email on every device. No registration or user switching is introduced.

Shopping lists cover the full saved date range. Share on supported phones can
send a copy to Google Keep; desktop Copy can be pasted there. Keep checkmarks do
not sync back. The Groceree cloud plan remains the source for shopping quantities.

### Upgrade an existing database before deployment
Apply each missing migration once, in order. These are additive and retain
existing plans, settings and recipes. Do not apply them to a fresh database
created from the current schema.sql, which already includes these changes.

```bash
npx wrangler d1 execute groceree --remote --file=./migrations/0001_plan_revision.sql
npx wrangler d1 execute groceree --remote --file=./migrations/0002_active_plan_dates.sql
# Use --local for an existing development database.
```

The second migration sets legacy start dates to their week Monday and infers
four/seven days from occupied slots (empty plans use user settings). Each user's
latest saved calendar week becomes active. No reseed or table rebuild is needed.

## 5. Deploy
```bash
npm run deploy     # vite build, then wrangler pages deploy dist
```
First deploy creates the Pages project. The D1 binding comes from `wrangler.toml`
(`[[d1_databases]] binding="DB"`). If the dashboard asks, also add it under
**Workers & Pages → groceree → Settings → Functions → D1 bindings** (variable `DB`
→ database `groceree`).

## 6. Custom domain
Pages project → **Custom domains → Set up a custom domain → `groceree.store`**.
Cloudflare provisions the certificate automatically since the domain is on your account.

## 7. Lock it down with Cloudflare Access (free, ≤50 users)
This is the login gate — no passwords in the app, and it protects the Gemini
endpoint from abuse.

1. Cloudflare dashboard → **Zero Trust → Access → Applications → Add an application
   → Self-hosted**.
2. Application domain: `groceree.store`.
3. Add a policy: **Action = Allow**, **Include → Emails →** your allowed addresses
   (add family/friends here — this is your allowlist).
4. Identity: enable **One-time PIN** (emails a code) and/or Google login.
5. Save. Now only listed emails can load the site; everyone else is blocked at the edge.

The Functions read the signed-in email from the `Cf-Access-Authenticated-User-Email`
header, so each allowed person automatically gets their own plans, pantry, settings,
and learned favourites — no extra code.

## Cost
Pages, D1, and Access are all on free tiers (D1: 5 GB / 5M reads-day; Access: 50
users). Only Gemini flyer parsing bills to Google, and only when you upload a flyer.

## What works now vs. next
Working: plan generation (seasonality × cost × ease × pantry × learning, auto
leftovers), diet/people settings, favourite/hide learning, shopping list,
shopping-list export to Obsidian / share sheet, prompt-a-recipe into a slot (Gemini, generated
at your household size), flyer upload → Gemini → deals + price history,
per-user data via Access.

Next iterations: drag-and-drop slot editing (currently click-a-slot then click a
recipe, or prompt one — **✨ Prompt** in the recipe rail invents a dish, scales it
to `household_size`, saves it and drops it into the waiting slot), the Shop
price-trend heatmap/line charts (need a few weeks of flyer data first), pantry
photo scanning, and folding price history into a "deal vs its own median" check.

## Re-generating the recipe DB
The 455-recipe seed is built from the source cookbook JSON by
`tools/rescue_recipes.py` (clean + categorise + name). Re-run it, then
`node scripts/build_seed_sql.mjs` and `npm run db:seed:remote` to refresh.
