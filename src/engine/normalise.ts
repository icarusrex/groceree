// Deterministic ingredient normalisation for the SHOPPING LIST.
// Recipes themselves keep their original text (cups, "shredded", etc.) for
// cooking. This module converts an ingredient into what you actually BUY:
// a raw ingredient name + a sensible buy unit (metric weight or whole count),
// because we're optimising for cheap raw ingredients over prepared food.
//
// No AI: a curated dictionary + rules. Covers the produce/meat/staples that
// actually appear in the recipe DB.

export interface BuyItem {
  name: string;        // clean raw ingredient, e.g. "carrot"
  display: string;     // Title Case for UI, e.g. "Carrots"
  quantity: number | null;
  unit: string;        // "g" | "kg" | "ml" | "" (whole count)
  category: string;
  staple: boolean;     // pantry/seasoning bought as a jar/pack, qty hidden
}

// ---- canonical raw ingredients: aliases -> {canonical, category, sold} ------
// sold: 'count' = whole items (1 onion), 'weight' = grams, 'pack' = staple.
type Sold = "count" | "weight" | "pack";
interface Canon { name: string; category: string; sold: Sold; gramsPerCup?: number; gramsPerItem?: number; gramsPerCan?: number; }

const DICT: { aliases: string[]; canon: Canon }[] = [
  // produce — count
  { aliases: ["onion", "yellow onion", "red onion", "brown onion", "white onion"], canon: { name: "onion", category: "produce", sold: "count", gramsPerCup: 160, gramsPerItem: 150 } },
  { aliases: ["spring onion", "green onion", "scallion"], canon: { name: "spring onion", category: "produce", sold: "count", gramsPerItem: 15 } },
  { aliases: ["garlic", "garlic clove", "clove garlic", "minced garlic"], canon: { name: "garlic", category: "produce", sold: "count", gramsPerItem: 5 } },
  { aliases: ["lemon", "preserved lemon"], canon: { name: "lemon", category: "produce", sold: "count", gramsPerItem: 100 } },
  { aliases: ["lime"], canon: { name: "lime", category: "produce", sold: "count", gramsPerItem: 70 } },
  { aliases: ["chilli", "chili", "chillies", "red chilli", "green chilli"], canon: { name: "chilli", category: "produce", sold: "count", gramsPerItem: 15 } },
  { aliases: ["cauliflower", "head of cauliflower"], canon: { name: "cauliflower", category: "produce", sold: "count", gramsPerItem: 600 } },
  { aliases: ["cabbage", "red cabbage", "purple cabbage", "white cabbage", "green cabbage"], canon: { name: "cabbage", category: "produce", sold: "count", gramsPerCup: 90, gramsPerItem: 900 } },
  { aliases: ["avocado"], canon: { name: "avocado", category: "produce", sold: "count", gramsPerItem: 170 } },
  { aliases: ["bell pepper", "pepper", "red pepper", "green pepper", "capsicum"], canon: { name: "bell pepper", category: "produce", sold: "count", gramsPerItem: 160 } },
  { aliases: ["egg", "eggs", "large egg"], canon: { name: "egg", category: "dairy", sold: "count", gramsPerItem: 55 } },
  { aliases: ["spaghetti squash"], canon: { name: "spaghetti squash", category: "produce", sold: "count", gramsPerCup: 155, gramsPerItem: 1500 } },
  { aliases: ["shallot"], canon: { name: "shallot", category: "produce", sold: "count", gramsPerItem: 40 } },
  { aliases: ["mango"], canon: { name: "mango", category: "produce", sold: "count", gramsPerItem: 200 } },
  { aliases: ["orange"], canon: { name: "orange", category: "produce", sold: "count", gramsPerItem: 130 } },
  { aliases: ["peach", "peaches", "nectarine"], canon: { name: "peach", category: "produce", sold: "count", gramsPerItem: 150 } },

  // produce — weight
  { aliases: ["carrot", "baby carrot", "heritage carrot"], canon: { name: "carrot", category: "produce", sold: "weight", gramsPerCup: 110, gramsPerItem: 70 } },
  { aliases: ["potato", "red-skinned potato", "new potato", "baby potato"], canon: { name: "potato", category: "produce", sold: "weight", gramsPerItem: 170 } },
  { aliases: ["sweet potato"], canon: { name: "sweet potato", category: "produce", sold: "weight", gramsPerItem: 200 } },
  { aliases: ["tomato", "plum tomato", "cherry tomato"], canon: { name: "tomato", category: "produce", sold: "weight", gramsPerCup: 180, gramsPerItem: 120, gramsPerCan: 400 } },
  { aliases: ["mushroom"], canon: { name: "mushroom", category: "produce", sold: "weight", gramsPerCup: 70 } },
  { aliases: ["broccoli", "tenderstem broccoli", "broccolini"], canon: { name: "broccoli", category: "produce", sold: "weight", gramsPerCup: 90 } },
  { aliases: ["spinach", "baby spinach"], canon: { name: "spinach", category: "produce", sold: "weight", gramsPerCup: 30 } },
  { aliases: ["kale"], canon: { name: "kale", category: "produce", sold: "weight", gramsPerCup: 67 } },
  { aliases: ["celery"], canon: { name: "celery", category: "produce", sold: "weight", gramsPerCup: 100 } },
  { aliases: ["green bean", "string bean"], canon: { name: "green bean", category: "produce", sold: "weight", gramsPerCup: 110 } },
  { aliases: ["courgette", "zucchini"], canon: { name: "courgette", category: "produce", sold: "weight", gramsPerItem: 200 } },
  { aliases: ["parsnip"], canon: { name: "parsnip", category: "produce", sold: "weight", gramsPerItem: 130 } },
  { aliases: ["brussels sprout", "brussel sprout"], canon: { name: "brussels sprouts", category: "produce", sold: "weight", gramsPerCup: 88 } },
  { aliases: ["coriander", "cilantro", "parsley", "fresh herb", "basil", "mint", "dill"], canon: { name: "fresh herbs", category: "produce", sold: "weight", gramsPerCup: 16 } },

  // tinned beans / pulses — weight (a tin ≈ 400g)
  { aliases: ["black bean"], canon: { name: "black beans", category: "pantry", sold: "weight", gramsPerCup: 170, gramsPerCan: 400 } },
  { aliases: ["kidney bean"], canon: { name: "kidney beans", category: "pantry", sold: "weight", gramsPerCup: 175, gramsPerCan: 400 } },
  { aliases: ["cannellini bean", "white bean", "butter bean", "haricot bean"], canon: { name: "white beans", category: "pantry", sold: "weight", gramsPerCup: 175, gramsPerCan: 400 } },
  { aliases: ["pinto bean"], canon: { name: "pinto beans", category: "pantry", sold: "weight", gramsPerCup: 170, gramsPerCan: 400 } },
  { aliases: ["mixed bean", "15 bean", "three bean", "three-bean"], canon: { name: "mixed beans", category: "pantry", sold: "weight", gramsPerCup: 170, gramsPerCan: 400 } },

  // meat / seafood — weight. (beef & pork handled by meatCanon() for cut granularity.)
  { aliases: ["chicken breast", "chicken"], canon: { name: "chicken breast", category: "meat", sold: "weight", gramsPerItem: 180, gramsPerCup: 140 } },
  { aliases: ["chicken thigh", "chicken leg", "chicken legs", "drumstick"], canon: { name: "chicken thighs", category: "meat", sold: "weight", gramsPerItem: 150 } },
  { aliases: ["whole chicken"], canon: { name: "whole chicken", category: "meat", sold: "count", gramsPerItem: 1500 } },
  { aliases: ["lamb", "lamb shoulder", "lamb shank", "lamb chop"], canon: { name: "lamb", category: "meat", sold: "weight", gramsPerItem: 400 } },
  { aliases: ["bacon", "pancetta"], canon: { name: "bacon", category: "meat", sold: "weight", gramsPerItem: 25 } },
  { aliases: ["sausage", "chorizo", "chouriço", "chourico", "chicken sausage", "pork sausage", "italian sausage", "bratwurst", "kielbasa"], canon: { name: "sausage", category: "meat", sold: "count", gramsPerItem: 75 } },
  { aliases: ["salmon", "salmon fillet"], canon: { name: "salmon", category: "seafood", sold: "weight", gramsPerItem: 150 } },
  { aliases: ["cod", "haddock", "white fish", "hake"], canon: { name: "white fish", category: "seafood", sold: "weight", gramsPerItem: 150 } },
  { aliases: ["tuna"], canon: { name: "tuna", category: "seafood", sold: "weight" } },
  { aliases: ["prawn", "shrimp", "king prawn"], canon: { name: "prawns", category: "seafood", sold: "weight", gramsPerCup: 145 } },
  { aliases: ["sardine"], canon: { name: "sardines", category: "seafood", sold: "count", gramsPerItem: 40 } },
  { aliases: ["anchovy", "anchovies"], canon: { name: "anchovies", category: "pantry", sold: "pack" } },

  // staples (bought as pack/jar — qty hidden)
  { aliases: ["olive oil", "extra-virgin olive oil", "vegetable oil", "avocado oil", "sunflower oil", "sesame oil"], canon: { name: "cooking oil", category: "pantry", sold: "pack" } },
  { aliases: ["salt", "pepper", "black pepper", "sea salt"], canon: { name: "salt & pepper", category: "pantry", sold: "pack" } },
  { aliases: ["coconut milk", "coconut cream"], canon: { name: "coconut milk", category: "pantry", sold: "weight", gramsPerCup: 240, gramsPerCan: 400 } },
  { aliases: ["rice", "basmati rice", "brown rice", "white rice"], canon: { name: "rice", category: "pantry", sold: "weight", gramsPerCup: 185 } },
  { aliases: ["pasta", "spaghetti", "penne", "noodle"], canon: { name: "pasta", category: "pantry", sold: "weight", gramsPerCup: 100 } },
  { aliases: ["lentil", "red lentil", "split lentil", "green lentil", "cooked lentil", "packet lentil"], canon: { name: "lentils", category: "pantry", sold: "weight", gramsPerCup: 200, gramsPerItem: 250, gramsPerCan: 400 } },
  { aliases: ["chickpea", "garbanzo"], canon: { name: "chickpeas", category: "pantry", sold: "weight", gramsPerCup: 160, gramsPerCan: 400 } },
  { aliases: ["flour", "plain flour", "self-raising flour"], canon: { name: "flour", category: "pantry", sold: "pack" } },
  { aliases: ["honey", "runny honey", "maple syrup", "sugar"], canon: { name: "honey/sugar", category: "pantry", sold: "pack" } },
  { aliases: ["soy sauce", "teriyaki sauce", "fish sauce", "oyster sauce", "coconut aminos", "vinegar", "curry paste", "tomato paste", "mustard", "tahini"], canon: { name: "", category: "pantry", sold: "pack" } },
  { aliases: ["bread", "ciabatta", "loaf", "pitta", "tortilla", "wrap"], canon: { name: "bread", category: "pantry", sold: "pack" } },
  { aliases: ["sesame seed", "spice", "seed", "paprika", "cumin", "oregano", "ras el hanout", "garam masala", "cinnamon", "nutmeg", "turmeric", "cardamom", "ginger", "cayenne", "chili powder", "chilli powder", "curry powder"], canon: { name: "", category: "pantry", sold: "pack" } },
  { aliases: ["rosemary", "thyme", "bay leaf", "bay leaves", "sage", "chive"], canon: { name: "dried herbs", category: "pantry", sold: "pack" } },
  { aliases: ["cashew", "walnut", "almond", "pecan", "peanut", "pine nut", "hazelnut"], canon: { name: "nuts", category: "pantry", sold: "pack" } },
  { aliases: ["date", "medjool date", "raisin", "sultana", "dried apricot", "cranberry"], canon: { name: "dried fruit", category: "pantry", sold: "pack" } },
  { aliases: ["frozen pea", "peas", "pea"], canon: { name: "frozen peas", category: "pantry", sold: "pack" } },
  { aliases: ["caper"], canon: { name: "capers", category: "pantry", sold: "pack" } },
  { aliases: ["salsa"], canon: { name: "salsa", category: "pantry", sold: "pack" } },
  { aliases: ["cornstarch", "cornflour", "corn starch"], canon: { name: "cornstarch", category: "pantry", sold: "pack" } },
  { aliases: ["clam", "mussel", "cockle"], canon: { name: "clams", category: "seafood", sold: "pack" } },
];

// Beef & pork need cut-level granularity so the list is shoppable ("Beef mince",
// "Pork shoulder") not bare "Beef". The cut words live in the recipe text but
// PREP would strip "minced"/"shredded", so we classify off the RAW name first.
function meatCanon(raw: string): Canon | null {
  const n = raw.toLowerCase();
  const has = (...w: string[]) => w.some((x) => n.includes(x));
  // sausage/cured/stock are handled elsewhere — don't claim them as a cut
  if (has("sausage", "chorizo", "chouriço", "chourico", "bacon", "pancetta", "broth", "stock", "bouillon")) return null;
  if (has("beef")) {
    if (has("ground", "mince")) return { name: "beef mince", category: "meat", sold: "weight", gramsPerCup: 225 };
    if (has("steak")) return { name: "beef steak", category: "meat", sold: "weight", gramsPerItem: 220 };
    if (has("rib")) return { name: "beef ribs", category: "meat", sold: "weight", gramsPerItem: 300 };
    if (has("stew", "chuck", "brisket", "shred", "pulled")) return { name: "beef stewing", category: "meat", sold: "weight", gramsPerCup: 225, gramsPerItem: 250 };
    return { name: "beef", category: "meat", sold: "weight", gramsPerCup: 225, gramsPerItem: 200 };
  }
  if (has("pork")) {
    if (has("ground", "mince")) return { name: "pork mince", category: "meat", sold: "weight", gramsPerCup: 225 };
    if (has("chop")) return { name: "pork chops", category: "meat", sold: "weight", gramsPerItem: 170 };
    if (has("tenderloin", "loin", "fillet", "escalope")) return { name: "pork tenderloin", category: "meat", sold: "weight", gramsPerItem: 450 };
    if (has("rib")) return { name: "pork ribs", category: "meat", sold: "weight", gramsPerItem: 700 };
    if (has("belly")) return { name: "pork belly", category: "meat", sold: "weight", gramsPerItem: 500 };
    if (has("shoulder", "butt", "shred", "pulled", "cheek")) return { name: "pork shoulder", category: "meat", sold: "weight", gramsPerItem: 1500 };
    return { name: "pork", category: "meat", sold: "weight", gramsPerItem: 300 };
  }
  return null;
}

const PREP = /\b(sliced|diced|chopped|minced|grated|shredded|crushed|cubed|cut|fresh|dried|cooked|raw|peeled|trimmed|halved|quartered|roasted|scraped|finely|roughly|thinly|small|large|medium|baby|mixed[- ]?colou?r|heritage|ripe|skinless|boneless|for garnish|for frying|to serve|to taste|extra|plus)\b/gi;

function stripToCore(raw: string): string {
  let n = raw.toLowerCase();
  n = n.replace(/\([^)]*\)/g, " ").replace(/,.*$/, "");
  n = n.replace(/\bstrands?\b.*?\bfrom\b/g, "").replace(/\bfrom \d.*$/g, "");
  n = n.replace(/^[\s\d½¼¾⅓⅔.,x×-]+/, "");
  // leading measure words ("heaped tablespoons fennel seeds" -> "fennel seeds")
  n = n.replace(/^(heaped|level|rounded|\s)*(tablespoons?|teaspoons?|tbsp|tsp|cups?|pinch(es)?|handful|sprigs?|cloves?|sachets?|packets?|tins?|cans?|jars?|bunch(es)?|heads?)\s+(of\s+)?/gi, "");
  n = n.replace(PREP, " ").replace(/\s+/g, " ").trim();
  return n;
}

function lookup(core: string): Canon | null {
  // longest-alias-first match so "chicken thigh" beats "chicken"
  let best: { canon: Canon; len: number } | null = null;
  for (const e of DICT) {
    for (const a of e.aliases) {
      if (core.includes(a) && (!best || a.length > best.len)) best = { canon: e.canon, len: a.length };
    }
  }
  return best?.canon ?? null;
}

// Unicode-safe title case: uppercase the first letter of each word without
// tripping on accented letters ("chouriço" stays "Chouriço", not "ChouriçO").
const titleCase = (s: string) =>
  s.replace(/(^|[\s\-/])(\p{L})/gu, (_, b, c) => b + (c as string).toUpperCase());

// Canonicalise the messy unit strings in the recipe DB to a small known set.
// Unknown units collapse to "" (whole count) so a quantity is never silently
// dropped into a separate shopping-list row.
const UNIT_SYNONYM: Record<string, string> = {
  g: "g", gram: "g", grams: "g", gr: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", l: "ml", litre: "ml", liter: "ml", litres: "ml", liters: "ml", pint: "ml", pints: "ml",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  oz: "oz", ounce: "oz", ounces: "oz",
  cup: "cup", cups: "cup",
  can: "can", cans: "can", tin: "can", tins: "can", jar: "can", jars: "can",
  clove: "", cloves: "", head: "", heads: "",
  unit: "", units: "", whole: "", each: "", x: "", un: "",
  medium: "", large: "", small: "",
  bunch: "", bunches: "", sprig: "", sprigs: "", handful: "", punnet: "",
  slice: "", slices: "", strip: "", strips: "", rasher: "", rashers: "",
  packet: "", pack: "", sachet: "",
};
function normUnit(unit: string): string {
  const u = (unit || "").toLowerCase().trim();
  if (u in UNIT_SYNONYM) return UNIT_SYNONYM[u];
  if (u === "" || u === "ml") return u;
  return ""; // unknown → treat as a whole count
}

// Convert one recipe ingredient into a raw buy-item.
export function toBuyItem(
  rawName: string, quantity: number | null, unit: string, fallbackCat: string,
): BuyItem {
  const lower = rawName.toLowerCase();
  // stock/broth is a pantry staple, not the meat it's named after
  if (/\b(broth|stock|bouillon)\b/.test(lower)) {
    return { name: "stock", display: "Stock", quantity: null, unit: "", category: "pantry", staple: true };
  }

  const core = stripToCore(rawName);
  const canon = meatCanon(rawName) ?? lookup(core);
  const u = normUnit(unit);

  if (!canon) {
    // unknown: keep cleaned name, drop cup/lb weirdness to a count-ish guess
    return { name: core || lower, display: titleCase(core || rawName),
      quantity: null, unit: "", category: fallbackCat, staple: fallbackCat === "pantry" };
  }
  if (canon.sold === "pack" || !canon.name) {
    return { name: canon.name || core, display: titleCase(canon.name || core),
      quantity: null, unit: "", category: "pantry", staple: true };
  }

  // resolve quantity into grams where we can
  let grams: number | null = null;
  if (quantity != null) {
    if (u === "g") grams = quantity;
    else if (u === "kg") grams = quantity * 1000;
    else if (u === "lb") grams = quantity * 454;
    else if (u === "oz") grams = quantity * 28;
    else if (u === "cup" && canon.gramsPerCup) grams = quantity * canon.gramsPerCup;
    else if (u === "can" && canon.gramsPerCan) grams = quantity * canon.gramsPerCan;
    else if (u === "" && canon.gramsPerItem) grams = quantity * canon.gramsPerItem;
  }

  if (canon.sold === "count") {
    // sell as whole items: prefer count if we had a count, else derive from grams
    let qty: number | null = null;
    if (u === "" && quantity != null) qty = Math.ceil(quantity);
    else if (u === "can" && quantity != null) qty = Math.ceil(quantity);
    else if (grams != null && canon.gramsPerItem) qty = Math.max(1, Math.ceil(grams / canon.gramsPerItem));
    else if (quantity != null) qty = Math.max(1, Math.ceil(quantity));
    return { name: canon.name, display: titleCase(canon.name), quantity: qty, unit: "",
      category: canon.category, staple: false };
  }

  // sold by weight → grams, rounded sensibly. Always emit a weight unit (even
  // with no resolvable quantity) so every occurrence shares one shopping row.
  let g = grams;
  if (g == null && quantity != null && canon.gramsPerItem) g = quantity * canon.gramsPerItem;
  if (g == null) return { name: canon.name, display: titleCase(canon.name), quantity: null,
    unit: "g", category: canon.category, staple: false };
  const rounded = g >= 1000 ? Math.round(g / 250) * 250 : Math.max(50, Math.round(g / 50) * 50);
  if (rounded >= 1000)
    return { name: canon.name, display: titleCase(canon.name), quantity: Math.round(rounded / 250) / 4,
      unit: "kg", category: canon.category, staple: false };
  return { name: canon.name, display: titleCase(canon.name), quantity: rounded, unit: "g",
    category: canon.category, staple: false };
}
