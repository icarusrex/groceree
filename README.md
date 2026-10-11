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

## Weekly plan sync
Settings already persist in D1. The current week's meal plan now loads from D1,
and generation, manual edits, AI edits, recipe replacements and slot removal all
save automatically. A status above the tabs shows saving, saved, and failures.
The Save button still waits for cloud acknowledgement; the shopping list derives
from the same plan. Leftover links and cooked portions survive a cloud round trip.

The week uses Monday in the **Europe/Lisbon** calendar on every device. Plans from
earlier weeks remain in D1. The app refreshes on focus, when becoming visible,
and every minute while visible. A new week starts empty rather than copying the
previous week. A failed load blocks editing until Retry succeeds.

On the first successful load, an old browser `localStorage.plan` is imported only
when that week's cloud plan does not exist. An existing cloud plan wins, including
an intentionally empty plan. The old key is removed after acknowledgement. Open
the app on the device holding the old plan first if it has never been saved.

Writes are ordered within a device and checked against the cloud revision. If
another device saves first, the stale device shows a conflict instead of
overwriting it. **Load cloud plan** discards that device's unsaved edits and loads
the newer week. Network failures keep edits in memory for **Retry** (and retry
when connectivity returns); keep the tab open until the cloud confirms the save.

The existing `user_id` scoping is preserved. For single-user use, the Cloudflare
Access allowlist should contain only your email, and every device must sign in as
that same email. Adding other users later requires an explicit Access policy
change; there is no registration or user switching in the app. Protect the Pages
hostname as well as the custom domain if it is publicly reachable.

### Upgrade an existing database before deployment
The new revision column is additive. Apply this once to an **existing** database:

```bash
npx wrangler d1 execute groceree --remote --file=./migrations/0001_plan_revision.sql
# use --local instead for an existing development database
```

Fresh databases get the column from `schema.sql`; do not apply the migration to
them again. No reseed is needed for the upgrade. Existing plans, settings and
recipes stay in place. Older saved leftover links are recovered when a matching
previous-day dinner exists. SQLite's existing `leftover_of` column accepts the
JSON link without a table rebuild.

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
