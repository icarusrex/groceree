// Third cleanup pass: drop the entire scraped "5 Ingredients" recipe set. Every
// one of these has a "5-ingredient recipe: …" description and instruction steps
// polluted by the *next* recipe's ALL-CAPS title bleeding in (e.g. a mushrooms
// recipe ending with a step "EASY RUSTIC GNOCCHI"), often with the real steps
// truncated mid-word ("…whiz to a smo"). The set is unsalvageable without
// re-scraping the source, and it's where all the junky sides live (baked
// mushrooms, asparagus & eggs, etc.). The remaining 213 American-style mains are
// clean. Writes a backup of the removed rows, then trims the seed.
// Run with --apply to write.
import { readFileSync, writeFileSync } from "node:fs";
const PATH = "./seed/recipes.seed.json";
const BACKUP = "./seed/removed_five_ingredient.json";
const apply = process.argv.includes("--apply");
const r = JSON.parse(readFileSync(PATH, "utf8"));

const steps = (x) => {
  const s = x.instructions;
  return Array.isArray(s) ? s : JSON.parse(s || "[]");
};
const isAllCaps = (s) => {
  const letters = [...s].filter((c) => /[a-zA-Z]/.test(c));
  return letters.length >= 3 && letters.every((c) => c === c.toUpperCase()) && s.length < 70;
};
const isBad = (x) =>
  (x.description || "").toLowerCase().startsWith("5-ingredient") ||
  steps(x).some(isAllCaps);

const removed = r.filter(isBad);
const kept = r.filter((x) => !isBad(x));
console.log(`removing ${removed.length}, keeping ${kept.length}`);

if (apply) {
  writeFileSync(BACKUP, JSON.stringify(removed, null, 2));
  writeFileSync(PATH, JSON.stringify(kept, null, 2));
  console.log(`wrote ${PATH} (${kept.length}) and backup ${BACKUP} (${removed.length})`);
}
