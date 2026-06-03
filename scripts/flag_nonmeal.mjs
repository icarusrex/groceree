// Flag breakfast / dessert / standalone-side recipes for removal. The plan wants
// simple complete-meal mains. Conservative by design: a strong SAVORY-MAIN guard
// fires FIRST so we never nuke a real meal that merely shares a word with a
// dessert ("crisp vegetables", "in romesco sauce", "over mashed potatoes").
//   - "all day mexican breakfast is OK" -> mexican egg dishes survive.
//   - savory pies/puddings/tarts (shepherd's pie, steak tartare) are mains.
//   - a side/salad that explicitly pairs with a protein is a meal.
// Run with --apply to write the trimmed seed.
import { readFileSync, writeFileSync } from "node:fs";
const PATH = "./seed/recipes.seed.json";
const apply = process.argv.includes("--apply");
const r = JSON.parse(readFileSync(PATH, "utf8"));

const nm = (x) => x.name.toLowerCase();
const hay = (x) => `${x.name} ${x.description || ""}`.toLowerCase();

// protein/main stems — NO trailing \b so plurals ("meatballs","prawns") match
const PROTEIN = /\b(chicken|beef|pork|lamb|steak|tartare|salmon|tuna|cod|haddock|prawn|shrimp|fish|seafood|turkey|duck|sausage|chorizo|chouri|bacon|ham|meatball|mince|carnitas|carne|gyro|kebab|kofta|tofu|halloumi|paneer|chickpea|lentil|bean)/;
// recognised savory main-dish forms
const MAINFORM = /\b(curry|stew|casserole|stir[- ]?fry|taco|burrito|enchilada|fajita|quesadilla|risotto|paella|pasta|noodle|ramen|pad thai|chili|chilli|soup|chowder|stroganoff|bolognese|lasagne|lasagna|tagine|biryani|pilaf|fried rice|bowl of|traybake|sheet[- ]?pan|one[- ]?pot|burger|wrap|frittata|shakshuka|quiche|huevos|chilaquiles|migas|romesco)\b/;

function keep(x) {
  const h = hay(x), n = nm(x);
  // mexican all-day breakfast — explicit user keep
  if (/\bmexican\b/.test(h) && /\b(breakfast|egg|eggs|huevos)\b/.test(h)) return true;
  // savory pies/puddings/tarts that share words with dessert
  if (/\b(shepherd'?s pie|cottage pie|pot pie|fish pie|chicken pie|steak pie|pork pie|tamale|empanada|quiche|frittata|shakshuka|strata|yorkshire pudding|black pudding|steak tartare|tartare)\b/.test(h)) return true;
  // a clear savory main: a protein/main-form in the NAME wins over any trigger
  if (PROTEIN.test(n) || MAINFORM.test(n)) return true;
  return false;
}

// generic (non-mexican) breakfast / snack — by NAME
const BREAKFAST = /\b(pancakes?|waffles?|french toast|granola|oatmeal|porridge|overnight oats|smoothie|smoothie bowl|cereal|bagel|muesli|acai|chia pudding|hash browns?|yoghurt bowl|yogurt bowl)\b/;
// dessert — by NAME
const DESSERT = /\b(cake|cupcake|cheesecake|brownies?|cookies?|ice cream|gelato|sorbet|mousse|tiramisu|trifle|custard|fudge|cobbler|crumble|pavlova|panna cotta|donut|doughnut|macarons?|tartelette|bakewell|fruit tart|jam tart|rice pudding|bread pudding|steamed pudding|sticky pudding|pudding pots?|christmas pudding|flan|parfait|truffle|sundae|banoffee)\b/;
// standalone side (name-only, no protein/main thanks to keep guard)
const SIDE = /\b(garlic bread|dinner rolls?|mashed potatoes?|roasted vegetables?|coleslaw|side salad|sauteed greens?|steamed (?:rice|broccoli|vegetables?)|bread rolls?|cornbread|biscuits?|hummus|guacamole)\b/;

// DESCRIPTION signals — these auto-renamed "5-ingredient recipe:" items hide the
// real dish in the description (name is a vague "X & Y Bowl/Salad").
const DESSERT_DESC = /\b(dessert|panna cotta|tartelette|frangipane|meringue|sticky toffee|cheesecake|ice cream|sorbet|gelato|mousse|tiramisu|trifle|custard|pavlova|fig tart|lemon tart|fruit tart|jam tart|pudding mash)\b/;
const BREAKFAST_DESC = /\b(breakfast|brunch)\b/;
// sweet ingredients confirm a dessert/sweet-breakfast; savory ones veto it
const SWEET_ING = /\b(sugar|icing|jam|marmalade|honey|chocolate|cocoa|ice cream|condensed milk|gelatine|gelatin|syrup|caramel|custard|nutella|marshmallow|meringue)\b/;
const MEAT_ING = /\b(chicken|beef|pork|lamb|steak|salmon|tuna|cod|haddock|prawn|shrimp|fish|seafood|turkey|duck|sausage|chorizo|chouri|bacon|ham|mince|anchov|mussel|clam|squid|calamari|crab|lobster)\b/;
const sweet = (x) => {
  const ings = (x.ingredients || []).map((i) => (i.name || "").toLowerCase()).join(" | ");
  return SWEET_ING.test(ings) && !MEAT_ING.test(ings);
};

const buckets = { breakfast: [], dessert: [], side: [] };
for (const x of r) {
  const n = nm(x), desc = (x.description || "").toLowerCase();
  // dessert/breakfast resolved FIRST (a vanilla-"bean" name must not protect a tart)
  if (DESSERT.test(n) || (DESSERT_DESC.test(desc) && sweet(x))) { buckets.dessert.push(x); continue; }
  if (BREAKFAST.test(n) || (BREAKFAST_DESC.test(desc) && sweet(x))) { buckets.breakfast.push(x); continue; }
  if (keep(x)) continue; // savory main — protect from the SIDE net
  if (SIDE.test(n)) buckets.side.push(x);
}

const flagged = new Set([...buckets.breakfast, ...buckets.dessert, ...buckets.side].map((x) => x.id));
for (const [k, list] of Object.entries(buckets)) {
  console.log(`\n=== ${k} (${list.length}) ===`);
  for (const x of list) console.log(`  ${x.name}  —  ${(x.description || "").slice(0, 64)}`);
}
console.log(`\n${flagged.size} flagged for removal; ${r.length - flagged.size} would remain.`);

if (apply) {
  const kept = r.filter((x) => !flagged.has(x.id));
  writeFileSync(PATH, JSON.stringify(kept, null, 2));
  console.log(`wrote ${PATH} (${kept.length} recipes)`);
}
