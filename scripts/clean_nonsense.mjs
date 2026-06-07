// Data-quality pass: kill nonsensical ingredients/steps the import left behind.
//  1. Remove the 15 "rescued-named" recipes — a corrupted batch (swap-notes as
//     ingredients, no quantities, ingredient names in the instructions field,
//     title bleed). Not cleanly salvageable; backed up before deletion.
//  2. In the remaining recipes:
//     - drop ingredients that are really instruction/time fragments
//       ("15 minutes", "to 30 minutes", "°F oven for 10 to 15 minutes"…)
//     - strip a leading "or " from alternative ingredients
//     - split ingredients merged on a fraction ("pineapple½ red bell pepper")
//     - repair merged steps ("Let rest for Break down the chicken…")
// Run with --apply to write.
import { readFileSync, writeFileSync } from "node:fs";
const PATH = "./seed/recipes.seed.json";
const apply = process.argv.includes("--apply");
const r = JSON.parse(readFileSync(PATH, "utf8"));

const parse = (v) => (Array.isArray(v) ? v : JSON.parse(v || "[]"));

// --- 1. drop the corrupted rescued-named batch ---
const removed = r.filter((x) => x.source === "rescued-named");
let kept = r.filter((x) => x.source !== "rescued-named");

// --- 2. ingredient + step repair on the rest ---
const FRAG = /\bminutes?\b|\bhours?\b|\bseconds?\b|\boven\b|°|preheat|\buntil\b|turn off|warmed through|\d+:\d{2}/i;
const FRACT = /[½¼¾⅓⅔⅛⅜⅝⅞]/;
const ALT = /^or\s+/i;

let droppedIng = 0, strippedOr = 0, splitIng = 0, fixedSteps = 0;

function cleanIngredients(list) {
  const out = [];
  for (const it of list) {
    let name = (it?.name || "").trim();
    if (!name) continue;
    if (FRAG.test(name)) { droppedIng++; continue; }       // time/instruction fragment
    if (ALT.test(name)) { name = name.replace(ALT, "").trim(); strippedOr++; }
    // split only when a fraction is glued DIRECTLY to a letter ("pineapple½ red
    // bell pepper") — that's the merge signature. A normal "(about ½ lemon)" has
    // a space before the fraction and must be left alone.
    const m = name.match(/^(.+[a-zA-Z])([½¼¾⅓⅔⅛⅜⅝⅞].*)$/);
    if (m) {
      out.push({ ...it, name: m[1].trim() });
      const right = m[2].trim();
      // keep the right half only if it still names a food (has a real word,
      // not just "½ to" / "¼ to" leftovers)
      if (/[a-z]{3,}/i.test(right.replace(/\b(to|tsp|tbsp|cup|cups|oz|g|kg|ml)\b/gi, ""))) {
        out.push({ name: right, quantity: null, unit: "", unit_norm: "", category: it.category || "pantry" });
      }
      splitIng++;
      continue;
    }
    out.push({ ...it, name });
  }
  return out;
}

// merged-step repair: "Let rest for <verb…>" lost its time and swallowed the next
// sentence. Cut it back to a clean rest instruction.
function cleanSteps(steps) {
  return steps.map((s) => {
    const m = s.match(/^let (?:it |the .+? )?rest for (break|carve|cook|stir|serve|remove|transfer|slice|cut|store)/i);
    if (m) { fixedSteps++; return "Let it rest about 15 minutes, then carve and serve."; }
    return s;
  });
}

kept = kept.map((x) => {
  const ings = cleanIngredients(parse(x.ingredients));
  const steps = cleanSteps(parse(x.instructions));
  return { ...x,
    ingredients: Array.isArray(x.ingredients) ? ings : JSON.stringify(ings),
    instructions: Array.isArray(x.instructions) ? steps : JSON.stringify(steps),
    ingredient_count: ings.length };
});

console.log(`removed rescued-named: ${removed.length}`);
console.log(`dropped fragment ingredients: ${droppedIng}`);
console.log(`stripped "or " prefixes: ${strippedOr}`);
console.log(`split fraction-merged ingredients: ${splitIng}`);
console.log(`repaired merged steps: ${fixedSteps}`);
console.log(`recipes: ${r.length} -> ${kept.length}`);

if (apply) {
  writeFileSync("./seed/removed_rescued_named.json", JSON.stringify(removed, null, 2));
  writeFileSync(PATH, JSON.stringify(kept, null, 2));
  console.log("written.");
}
