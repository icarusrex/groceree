// Restores ingredient lines that the "clean" import dropped — mostly the main
// protein, which the method still calls for ("Add the chicken…", "Thinly slice
// the brisket…"). Without them those meals put no protein on the shopping list
// and can't be costed. Amounts are sized to each recipe's servings and method.
//
// Base = the LIVE recipes (they carry later clean-ups the seed lacks, e.g.
// "͆our" → "flour"), so pass a D1 export:
//   npx wrangler d1 execute groceree --remote --json --command "SELECT * FROM recipes" > /tmp/recipes.json
//   node scripts/fix_missing_proteins.mjs /tmp/recipes.json
// Writes the repaired recipes into seed/recipes.seed.json and the matching
// UPDATEs to seed/fix_missing_proteins.sql (apply with wrangler d1 execute --file).
// Also repairs the "fl" the import turned into a stray combining mark.
// Idempotent: a line whose name is already present isn't added again.
import { readFileSync, writeFileSync } from "node:fs";

const NORM = { g: "g", cup: "cup", tbsp: "tbsp", tsp: "tsp", clove: "", "": "" };
const ing = (name, quantity, unit, category) => ({ name, quantity, unit, unit_norm: NORM[unit] ?? unit, category });

const FIX = {
  "roasted-tomato-soup-and-grilled-turkey-and-cheese-sandwiches": { add: [
    ing("sliced turkey breast", 225, "g", "meat"),
    ing("canned whole tomatoes", 800, "g", "pantry")] },
  "philly-cheesesteak-loaded-fries": { add: [
    ing("potatoes, cut into wedges", 1000, "g", "produce"),
    ing("cooked beef brisket, thinly sliced", 450, "g", "meat"),
    ing("green bell pepper", 1, "", "produce"),
    ing("red bell pepper", 1, "", "produce"),
    ing("yellow onion", 1, "", "produce")] },
  "lemon-ginger-chicken-stir-fry": { add: [
    ing("cooked chicken breast, sliced", 450, "g", "meat"),
    ing("coconut aminos", 0.25, "cup", "pantry"),
    ing("fresh ginger, grated", 1, "tbsp", "produce"),
    ing("honey", 1, "tbsp", "pantry"),
    ing("garlic", 2, "clove", "produce")] },
  "crusted-chicken-pot-pie": { add: [
    ing("cooked shredded chicken breast", 450, "g", "meat"),
    ing("potatoes, for the mash", 700, "g", "produce"),
    ing("parsnips, for the mash", 300, "g", "produce")] },
  "cashew-chicken": { add: [
    ing("cooked chicken breast, cubed", 450, "g", "meat"),
    ing("broccoli florets", 2, "cup", "produce"),
    ing("roasted cashews", 0.5, "cup", "pantry"),
    ing("coconut aminos", 0.25, "cup", "pantry")] },
  "tuscan-turkey-kale-soup": { add: [
    ing("cooked shredded turkey breast", 450, "g", "meat")] },
  "italian-wedding-soup": { add: [
    ing("chicken mince, rolled into small meatballs", 450, "g", "meat")] },
  "swedish-meatballs-over-mashed-potatoes": { add: [
    ing("beef mince, rolled into meatballs", 450, "g", "meat"),
    ing("potatoes, for the mash", 900, "g", "produce")] },
  "bbq-brisket-bowls": { add: [
    ing("cooked beef brisket", 680, "g", "meat")] },
  "chipotle-brisket-tacos-with-green-apple-slaw": { add: [
    ing("cooked beef brisket", 450, "g", "meat")] },
  "brisket-fried-rice": { add: [
    ing("cooked beef brisket", 450, "g", "meat")] },
  "skillet-turkey-enchiladas": { add: [
    ing("ground turkey", 450, "g", "meat"),
    ing("yellow onion", 1, "", "produce"),
    ing("green bell pepper", 1, "", "produce"),
    ing("garlic", 2, "clove", "produce"),
    ing("ground cumin", 1, "tsp", "pantry"),
    ing("dried oregano", 1, "tsp", "pantry"),
    ing("canned pinto beans, drained", 400, "g", "pantry"),
    ing("corn tortillas, torn", 6, "", "pantry"),
    ing("fresh cilantro", 0.25, "cup", "produce")] },
  "broiled-barbecue-flank-steak-with-mango-salsa": { add: [
    ing("mango", 1, "", "produce"),
    ing("lime", 1, "", "produce"),
    ing("fresh cilantro", 0.25, "cup", "produce"),
    ing("onion powder", 1, "tsp", "pantry"),
    ing("chili powder", 1, "tsp", "pantry")] },
  // Tagged "chicken" only for its broth — it's a cheese & veg chowder. Adding
  // the milk and Cheddar the method uses makes it NOT dairy-free.
  "cheesy-broccoli-and-cauliflower-chowder": { set: { primary_protein: "none", is_dairy_free: 0, contains_dairy: 1 }, add: [
    ing("yellow onion", 1, "", "produce"),
    ing("carrot", 1, "", "produce"),
    ing("celery stalk", 1, "", "produce"),
    ing("garlic", 2, "clove", "produce"),
    ing("milk", 2, "cup", "dairy"),
    ing("cheddar cheese, shredded", 1, "cup", "dairy")] },
  "one-pot-american-chop-suey": { add: [
    ing("beef mince", 225, "g", "meat"),
    ing("yellow onion", 0.5, "", "produce"),
    ing("green bell pepper", 0.5, "", "produce"),
    ing("red bell pepper", 0.5, "", "produce"),
    ing("garlic", 2, "clove", "produce"),
    ing("worcestershire sauce", 1, "tsp", "pantry"),
    ing("bay leaf", 1, "", "pantry")] },
  // These two are turkey dishes that lost the turkey line and were then tagged
  // vegetarian from what was left — a vegetarian would have been served turkey.
  "mini-meatloaves-and-green-beans": { set: { primary_protein: "turkey", is_vegetarian: 0, is_pescatarian: 0 }, add: [
    ing("ground turkey", 450, "g", "meat"),
    ing("garlic", 2, "clove", "produce"),
    ing("egg", 1, "", "dairy"),
    ing("worcestershire sauce", 1, "tsp", "pantry"),
    ing("grill seasoning", 1, "tsp", "pantry")] },
  "asian-peanut-lettuce-wraps": { set: { primary_protein: "turkey", is_vegetarian: 0, is_pescatarian: 0 }, add: [
    ing("ground turkey", 450, "g", "meat"),
    ing("garlic", 2, "clove", "produce"),
    ing("butter lettuce", 1, "", "produce"),
    ing("roasted peanuts, chopped", 0.25, "cup", "pantry"),
    ing("lime, cut into wedges", 1, "", "produce")] },
  "gyro-salad-with-garlic-potato-wedges": { set: { primary_protein: "beef" }, add: [
    ing("potatoes, cut into wedges", 800, "g", "produce"),
    ing("cooked beef brisket, thinly sliced", 450, "g", "meat"),
    ing("greek dressing", 0.33, "cup", "pantry")] },
  "sweet-and-spicy-pepper-jelly-chicken-and-cauliflower": { add: [
    ing("boneless chicken thighs", 450, "g", "meat"),
    ing("apricot preserves", 2, "tbsp", "pantry"),
    ing("garlic", 1, "clove", "produce")] },
};

const live = JSON.parse(readFileSync(process.argv[2], "utf8"))[0].results;
const liveById = new Map(live.map((r) => [r.id, r]));
const seed = JSON.parse(readFileSync("./seed/recipes.seed.json", "utf8"));
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const sql = ["-- generated by scripts/fix_missing_proteins.mjs"];
let added = 0;

for (const [id, fix] of Object.entries(FIX)) {
  const row = liveById.get(id);
  const s = seed.find((r) => r.id === id);
  if (!row || !s) throw new Error(`recipe not found: ${id}`);
  // Live names/amounts win (they're cleaned), but some live lines lost their
  // category/unit_norm in that clean-up — refill those from the seed's line in
  // the same position (same recipe, same order, same count).
  const liveLines = JSON.parse(row.ingredients);
  const ingredients = liveLines.length === s.ingredients.length
    ? liveLines.map((l, k) => ({ ...s.ingredients[k], ...l }))
    : liveLines;
  const have = new Set(ingredients.map((i) => i.name.toLowerCase()));
  for (const a of fix.add) if (!have.has(a.name.toLowerCase())) { ingredients.push(a); added++; }
  Object.assign(s, { ingredients, ingredient_count: ingredients.length }, fix.set || {});
  const sets = [`ingredients=${q(JSON.stringify(ingredients))}`, `ingredient_count=${ingredients.length}`,
    ...Object.entries(fix.set || {}).map(([k, v]) => `${k}=${typeof v === "number" ? v : q(v)}`)];
  sql.push(`UPDATE recipes SET ${sets.join(", ")} WHERE id=${q(id)};`);
}

// The same import mangled the "ﬂ" ligature into a stray combining mark (U+0346):
// "red pepper ͆akes", "͆our", "͆at-leaf parsley". Put the "fl" back everywhere.
const FL = "\u0346";
sql.push(...["ingredients", "instructions", "name", "description"].map((f) =>
  `UPDATE recipes SET ${f}=REPLACE(${f}, char(838), 'fl') WHERE instr(${f}, char(838)) > 0;`));

writeFileSync("./seed/recipes.seed.json", JSON.stringify(seed, null, 2).replaceAll(FL, "fl"));
writeFileSync("./seed/fix_missing_proteins.sql", sql.join("\n") + "\n");
console.log(`${Object.keys(FIX).length} recipes, ${added} lines added → seed/recipes.seed.json + seed/fix_missing_proteins.sql`);
