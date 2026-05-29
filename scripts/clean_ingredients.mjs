#!/usr/bin/env node
// One-time ingredient cleanup. Reads recipes from your LIVE site, asks Gemini to
// normalise each recipe's ingredients into clean buy-items, and writes them back
// to D1. After this runs, shopping lists, recipe cards, and dedup are all clean —
// with ZERO per-plan AI cost.
//
// Why this is the right fix: the source ingredient strings carry prep noise
// ("strands scraped from 1 roasted spaghetti squash", "green onions, cut into
// 1-inch pieces"). No regex fixes that reliably; an LLM does it once, cheaply.
//
// Prereqts: GEMINI_API_KEY secret already set on the Pages project (it is), and
// the site reachable. Run from your machine:
//
//   node scripts/clean_ingredients.mjs https://groceree.store
//
// It calls your own /api/clean-ingredients endpoint (added in functions/api),
// so the key never leaves Cloudflare. Safe to re-run; it's idempotent.

const BASE = process.argv[2] || "https://groceree.store";
const BATCH = 20;

const recipes = await (await fetch(`${BASE}/api/recipes`)).json();
console.log(`Fetched ${recipes.length} recipes. Cleaning in batches of ${BATCH}…`);

let cleaned = 0, failed = 0;
for (let i = 0; i < recipes.length; i += BATCH) {
  const batch = recipes.slice(i, i + BATCH);
  const res = await fetch(`${BASE}/api/clean-ingredients`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipe_ids: batch.map((r) => r.id) }),
  });
  if (!res.ok) { failed += batch.length; console.log(`  batch ${i}: FAILED (${res.status})`); continue; }
  const out = await res.json();
  cleaned += out.updated || 0;
  console.log(`  batch ${i / BATCH + 1}/${Math.ceil(recipes.length / BATCH)}: ${out.updated} updated (total ${cleaned})`);
}
console.log(`\nDone. ${cleaned} recipes cleaned, ${failed} failed.`);
console.log("Shopping lists will now be clean. No redeploy needed — data is in D1.");
