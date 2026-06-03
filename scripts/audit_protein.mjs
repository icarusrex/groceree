import { readFileSync } from "node:fs";
const r = JSON.parse(readFileSync("./seed/recipes.seed.json", "utf8"));

const dist = {};
for (const x of r) { const k = x.primary_protein || "(missing)"; dist[k] = (dist[k] || 0) + 1; }
console.log("=== primary_protein distribution ===");
for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(4), k);

// Infer the protein the recipe SHOULD have, from name + ingredient names.
const FISH = /tuna|salmon|cod|haddock|prawn|shrimp|\bfish\b|sardine|mackerel|hake|trout|seafood|clam|mussel|anchov|squid|calamari|pollock|tilapia/;
const CHICKEN = /chicken|turkey|poultry/;
const PORK = /\bpork\b|bacon|ham\b|chorizo|chouri|sausage|pancetta|prosciutto/;
const BEEF = /\bbeef\b|steak|mince(?!d (?:pork|lamb))|brisket|\bchuck\b|sirloin|\bribs?\b|meatball|ground beef/;
const LAMB = /\blamb\b|mutton/;
const EGG = /\begg\b|eggs|omelette|frittata|shakshuka/;

function ingText(x) {
  return (x.ingredients || []).map((i) => (i.name || "").toLowerCase()).join(" | ");
}
function infer(x) {
  const hay = (x.name + " " + ingText(x)).toLowerCase();
  // order matters: fish/chicken/pork/lamb/beef before egg before none
  if (FISH.test(hay)) return "fish";
  if (CHICKEN.test(hay)) return "chicken";
  if (PORK.test(hay)) return "pork";
  if (LAMB.test(hay)) return "lamb";
  if (BEEF.test(hay)) return "beef";
  if (EGG.test(hay)) return "egg";
  return "none";
}

// Normalise existing labels to compare families (seafood==fish, etc.)
const fam = (p) => {
  const s = (p || "").toLowerCase();
  if (/fish|seafood|salmon|tuna|cod|prawn|shrimp/.test(s)) return "fish";
  if (/chicken|turkey|poultry/.test(s)) return "chicken";
  if (/pork|bacon|sausage|chorizo/.test(s)) return "pork";
  if (/beef/.test(s)) return "beef";
  if (/lamb/.test(s)) return "lamb";
  if (/egg/.test(s)) return "egg";
  if (s === "none" || s === "" ) return "none";
  return s;
};

const mismatches = [];
for (const x of r) {
  const want = infer(x);
  const have = fam(x.primary_protein);
  if (want !== have) mismatches.push({ id: x.id, name: x.name, have: x.primary_protein, want, ings: ingText(x).slice(0, 90) });
}
console.log(`\n=== ${mismatches.length} mismatches (have -> want) ===`);
for (const m of mismatches) console.log(`${(m.have||"?").padEnd(9)} -> ${m.want.padEnd(8)} | ${m.name}`);
