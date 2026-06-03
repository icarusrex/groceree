// Runs toBuyItem over every seed ingredient and reports duplicate-bucket
// smells + unknowns. Uses esbuild (a vite dep) to transpile the TS on the fly.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const out = await build({
  entryPoints: ["./src/engine/normalise.ts"],
  bundle: true, format: "esm", write: false, logLevel: "silent",
});
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64")
);
const { toBuyItem } = mod;

const recipes = JSON.parse(readFileSync("./seed/recipes.seed.json", "utf8"));

// map canonical buy-name -> set of bucket keys it lands in
const buckets = new Map();
const unknownCats = {};
let total = 0;
for (const r of recipes) {
  for (const ing of r.ingredients || []) {
    total++;
    const b = toBuyItem(ing.name, ing.quantity ?? null, ing.unit ?? "", ing.category ?? "pantry");
    if (!b.name) continue;
    const isWeight = b.unit === "g" || b.unit === "kg";
    const key = b.staple ? "staple" : isWeight ? "w" : b.unit || "count";
    if (!buckets.has(b.display)) buckets.set(b.display, new Set());
    buckets.get(b.display).add(key);
  }
}

// duplicate smell: same display name in BOTH a weight bucket and a count bucket
const split = [...buckets.entries()].filter(([, s]) => s.size > 1);
console.log("ingredients processed:", total);
console.log("distinct buy-names:", buckets.size);
console.log("\n--- names landing in >1 bucket type (would be duplicate rows) ---");
if (!split.length) console.log("none ✓");
for (const [name, s] of split) console.log(name, "->", [...s].join(", "));

// sample a few meat items to eyeball cut granularity
console.log("\n--- meat samples ---");
const seen = new Set();
for (const r of recipes) for (const ing of r.ingredients || []) {
  if (!/beef|pork|chouri|chorizo|chicken/i.test(ing.name)) continue;
  const b = toBuyItem(ing.name, ing.quantity ?? null, ing.unit ?? "", ing.category ?? "pantry");
  const line = `${ing.name} [${ing.unit}|${ing.quantity}] -> ${b.display} ${b.quantity ?? ""}${b.unit}`;
  if (seen.has(line)) continue; seen.add(line);
}
const samp = [...seen].sort().slice(0, 30);
for (const l of samp) console.log(l);
