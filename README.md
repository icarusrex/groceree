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

## 4. Run locally
```bash
npm run dev        # UI only (fast), API calls need the line below
npm run preview    # full stack: builds, serves app + Functions + local D1
```

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
leftovers), diet/people settings, favourite/hide learning, shopping list, flyer
upload → Gemini → deals + price history, per-user data via Access.

Next iterations: drag-and-drop slot editing (currently click-a-slot then click a
recipe), the Shop price-trend heatmap/line charts (need a few weeks of flyer data
first), pantry photo scanning, and folding price history into a "deal vs its own
median" check.

## Re-generating the recipe DB
The 455-recipe seed is built from the source cookbook JSON by
`tools/rescue_recipes.py` (clean + categorise + name). Re-run it, then
`node scripts/build_seed_sql.mjs` and `npm run db:seed:remote` to refresh.
