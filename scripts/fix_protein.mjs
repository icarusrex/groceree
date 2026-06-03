// Re-derive primary_protein from recipe name (priority) then main ingredients.
// Broth/stock/sauce mentions are stripped so "fish sauce" / "chicken broth"
// don't masquerade as the protein. Run with --apply to write changes.
import { readFileSync, writeFileSync } from "node:fs";
const PATH = "./seed/recipes.seed.json";
const apply = process.argv.includes("--apply");
const r = JSON.parse(readFileSync(PATH, "utf8"));

const STRIP = /\b(broth|stock|bouillon|sauce|paste|powder|cube|stockpot|seasoning|gravy|worcestershire)\b/g;

// name-based: ORDER-IN-NAME wins (first protein keyword in the title decides).
// "tuna steak" -> fish (tuna precedes steak); "Carne de Porco com Amêijoas
// (Pork with Clams)" -> pork (porco precedes clams), not fish. Plural-safe stems:
// leading \b avoids mid-word hits, no trailing \b so plurals ("chickens",
// "scallops", "sardines") still match. "bolognese"/"stroganoff" deliberately
// omitted (a lentil bolognese is vegetarian) — those resolve via ingredients.
const FISH = /\b(salmon|tuna|cod\b|haddock|halibut|hake\b|pollock|tilapia|sea ?bass|sea ?bream|monkfish|trout|mackerel|sardine|anchov|prawn|shrimp|scampi|scallop|crab|lobster|mussel|clam|vongole|squid|calamari|octopus|fish|seafood)/;
const NAME = [
  ["fish", FISH],
  ["chicken", /\b(chicken|poussin)/],
  ["turkey", /\bturkey/],
  ["duck", /\b(duck|pato\b)/],
  ["pork", /\b(pork|porco|bacon|chorizo|chouri|pancetta|prosciutto|gammon|nduja|sausage|salami|ham\b)/],
  ["lamb", /\b(lamb|mutton|kofta)/],
  // "carne" dropped: Portuguese for "meat" generally (carne de porco = pork),
  // not beef — it false-matched "Carne de Porco à Alentejana" at index 0.
  ["beef", /\b(beef|steak|cheesesteak|brisket|sirloin|meatball)/],
];
const ING = [
  ["fish", FISH],
  ["chicken", /\bchicken/],
  ["turkey", /\bturkey/],
  ["duck", /\bduck/],
  ["pork", /\b(pork|bacon|chorizo|chouri|pancetta|prosciutto|gammon|nduja|sausage|salami|ham\b)/],
  ["lamb", /\b(lamb|mutton)/],
  // bare "mince" dropped: it false-matches "minced ginger"/"minced garlic" and
  // wrongly beefs vegetarian dishes. "ground beef" still lands via the beef stem.
  ["beef", /\b(beef|brisket|sirloin|meatball|bresaola)/],
];

function classify(x) {
  const name = x.name.toLowerCase();
  // earliest-matching protein keyword in the NAME wins
  let bestP = null, bestIdx = Infinity;
  for (const [p, re] of NAME) {
    const m = name.match(re);
    if (m && m.index < bestIdx) { bestIdx = m.index; bestP = p; }
  }
  if (bestP) return bestP;
  const ings = (x.ingredients || []).map((i) => (i.name || "").toLowerCase().replace(STRIP, " ")).join(" | ");
  for (const [p, re] of ING) if (re.test(ings)) return p;
  return "none";
}
const fam = (p) => {
  const s = (p || "none").toLowerCase();
  if (/fish|seafood|salmon|tuna|cod|prawn|shrimp/.test(s)) return "fish";
  if (/chicken/.test(s)) return "chicken";
  if (/turkey/.test(s)) return "turkey";
  if (/duck/.test(s)) return "duck";
  if (/pork|bacon|sausage|chorizo/.test(s)) return "pork";
  if (/lamb/.test(s)) return "lamb";
  if (/beef/.test(s)) return "beef";
  return s === "" ? "none" : s;
};

let changed = 0;
for (const x of r) {
  const want = classify(x);
  if (fam(x.primary_protein) === want) continue;
  changed++;
  const ings = (x.ingredients || []).map((i) => i.name).slice(0, 5).join(", ");
  console.log(`${(x.primary_protein || "?").padEnd(8)} -> ${want.padEnd(8)} | ${x.name}`);
  console.log(`           ings: ${ings}`);
  if (apply) x.primary_protein = want;
}
console.log(`\n${changed} changes${apply ? " APPLIED" : " (dry-run; pass --apply to write)"}`);
if (apply) { writeFileSync(PATH, JSON.stringify(r, null, 2)); console.log("wrote " + PATH); }
