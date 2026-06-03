// Second cleanup pass: drop no-protein "salad" items that are really plain
// produce/fruit SIDES, plus a couple of literal non-meals (just "Cheese", a
// strawberry-curd dessert bowl). Conservative rescues so we don't nuke a real
// meal that merely got auto-named "X & Y Salad":
//   - description names a cooked main (pasta/gnocchi/omelette/tart/fritter…)
//   - name carries a real legume/grain base (chickpea, three-bean, grain…)
//   - name carries a meat/protein word (e.g. "Gyro …") that the tagger missed
// Run with --apply to write the trimmed seed.
import { readFileSync, writeFileSync } from "node:fs";
const PATH = "./seed/recipes.seed.json";
const apply = process.argv.includes("--apply");
const r = JSON.parse(readFileSync(PATH, "utf8"));

const nm = (x) => x.name.toLowerCase();
const hay = (x) => `${x.name} ${x.description || ""}`.toLowerCase();

const MAIN = /\b(pasta|lasagne|lasagna|gnocchi|risotto|tortilla|omelette|omelet|frittata|fritter|gratin|bake|baked|stew|tart|pie|tagine|curry|noodle|orzo|couscous|bulgur|pilaf|paella|quiche|pancake|stuffed)\b/;
const BASE = /\b(chickpea|lentil|three-?bean|bean|grain|quinoa|farro|barley|tofu|halloumi)/;
// real protein/meat the tagger missed (gyro, kebab, etc.) — no trailing \b for plurals
const MEAT = /\b(gyro|kebab|kofta|chicken|beef|pork|lamb|steak|salmon|tuna|prawn|shrimp|chorizo|sausage|bacon|ham|duck|turkey)/;

// explicit junk to drop regardless (literal cheese snack, dessert bowl)
const JUNK_NAMES = new Set(["cheese", "strawberries, cheese & curd bowl"]);

const remove = new Set();
for (const x of r) {
  const n = nm(x);
  if (JUNK_NAMES.has(n)) { remove.add(x.id); continue; }
  if (!/\bsalad\b/.test(n)) continue;
  if (x.primary_protein !== "none") continue;
  const h = hay(x);
  if (MAIN.test(h) || BASE.test(n) || MEAT.test(n)) continue; // rescued
  remove.add(x.id);
}

const removed = r.filter((x) => remove.has(x.id));
console.log(`=== removing ${removed.length} ===`);
for (const x of removed) console.log("  " + x.name);
console.log(`\n${r.length - removed.length} would remain.`);

if (apply) {
  const kept = r.filter((x) => !remove.has(x.id));
  writeFileSync(PATH, JSON.stringify(kept, null, 2));
  console.log(`wrote ${PATH} (${kept.length} recipes)`);
}
