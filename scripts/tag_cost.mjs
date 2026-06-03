// Tags each recipe with a static cost_tier (1 = cheap to make … 4 = premium),
// the average base price-tier of its ingredients. Uses the SAME baseTier map the
// engine uses (src/data/cost_tiers.ts), transpiled on the fly so the two can't
// drift. This is the intrinsic, discount-free cost of a recipe; flyer discounts
// still adjust value at recommend-time. Lets the planner prefer cheap meals when
// asked. Run with --apply to write the tags into the seed.
import { readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const PATH = "./seed/recipes.seed.json";
const apply = process.argv.includes("--apply");

// load baseTier from the TS source, transpiled to an ESM data: URL
const out = await build({
  entryPoints: ["src/data/cost_tiers.ts"],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64")
);
const { baseTier } = mod;

const r = JSON.parse(readFileSync(PATH, "utf8"));

// Two signals beat a plain average (which regresses everything to the default
// tier 2): the MEAN cheapness of the ingredients, and whether ANY premium
// (tier-4) ingredient is present. A single pricey hero ingredient is what makes
// a meal feel expensive, so a premium item pulls the recipe up a tier or two.
//   tier 1 = budget (staple-heavy, no premium)   …   tier 4 = treat/premium
function costTier(recipe) {
  const tiers = (recipe.ingredients || []).map((i) => baseTier(i.name || ""));
  const n = tiers.length || 1;
  const cheap = tiers.reduce((s, t) => s + (4 - t) / 3, 0) / n; // 0..1, 1 = cheap
  const hasPremium = tiers.some((t) => t === 4);
  if (hasPremium && cheap < 0.62) return 4;
  if (hasPremium || cheap < 0.6) return 3;
  if (cheap >= 0.72) return 1;
  return 2;
}

const dist = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (const x of r) {
  x.cost_tier = costTier(x);
  dist[x.cost_tier]++;
}
console.log("cost_tier distribution:", dist);
console.log("cheap (tier 1):");
for (const x of r.filter((x) => x.cost_tier === 1).slice(0, 20)) console.log("  " + x.name);
console.log("premium (tier 4):");
for (const x of r.filter((x) => x.cost_tier === 4).slice(0, 20)) console.log("  " + x.name);

if (apply) {
  writeFileSync(PATH, JSON.stringify(r, null, 2));
  console.log(`\nwrote ${PATH} with cost_tier on ${r.length} recipes.`);
}
