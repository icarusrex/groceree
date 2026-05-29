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
interface Canon { name: string; category: string; sold: Sold; gramsPerCup?: number; gramsPerItem?: number; }

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

  // produce — weight
  { aliases: ["carrot", "baby carrot", "heritage carrot"], canon: { name: "carrot", category: "produce", sold: "weight", gramsPerCup: 110, gramsPerItem: 70 } },
  { aliases: ["potato", "red-skinned potato", "new potato", "baby potato"], canon: { name: "potato", category: "produce", sold: "weight", gramsPerItem: 170 } },
  { aliases: ["sweet potato"], canon: { name: "sweet potato", category: "produce", sold: "weight", gramsPerItem: 200 } },
  { aliases: ["tomato", "plum tomato", "cherry tomato"], canon: { name: "tomato", category: "produce", sold: "weight", gramsPerCup: 180, gramsPerItem: 120 } },
  { aliases: ["mushroom"], canon: { name: "mushroom", category: "produce", sold: "weight", gramsPerCup: 70 } },
  { aliases: ["broccoli", "tenderstem broccoli", "broccolini"], canon: { name: "broccoli", category: "produce", sold: "weight", gramsPerCup: 90 } },
  { aliases: ["spinach", "baby spinach"], canon: { name: "spinach", category: "produce", sold: "weight", gramsPerCup: 30 } },
  { aliases: ["kale"], canon: { name: "kale", category: "produce", sold: "weight", gramsPerCup: 67 } },
  { aliases: ["celery"], canon: { name: "celery", category: "produce", sold: "weight", gramsPerCup: 100 } },
  { aliases: ["green bean", "string bean"], canon: { name: "green bean", category: "produce", sold: "weight", gramsPerCup: 110 } },
  { aliases: ["courgette", "zucchini"], canon: { name: "courgette", category: "produce", sold: "weight", gramsPerItem: 200 } },
  { aliases: ["coriander", "cilantro", "parsley", "fresh herb", "basil", "mint", "dill"], canon: { name: "fresh herbs", category: "produce", sold: "weight", gramsPerCup: 16 } },

  // meat / seafood — weight
  { aliases: ["chicken breast", "chicken"], canon: { name: "chicken breast", category: "meat", sold: "weight", gramsPerItem: 180, gramsPerCup: 140 } },
  { aliases: ["chicken thigh", "chicken leg", "chicken legs", "drumstick"], canon: { name: "chicken thighs", category: "meat", sold: "weight", gramsPerItem: 150 } },
  { aliases: ["whole chicken"], canon: { name: "whole chicken", category: "meat", sold: "count", gramsPerItem: 1500 } },
  { aliases: ["beef", "ground beef", "beef mince", "minced beef", "brisket", "steak"], canon: { name: "beef", category: "meat", sold: "weight", gramsPerCup: 225 } },
  { aliases: ["pork", "pork shoulder", "pork chop", "pork loin"], canon: { name: "pork", category: "meat", sold: "weight" } },
  { aliases: ["lamb", "lamb shoulder", "lamb shank", "lamb chop"], canon: { name: "lamb", category: "meat", sold: "weight", gramsPerItem: 400 } },
  { aliases: ["bacon", "pancetta"], canon: { name: "bacon", category: "meat", sold: "weight" } },
  { aliases: ["sausage", "chorizo"], canon: { name: "sausage", category: "meat", sold: "count", gramsPerItem: 75 } },
  { aliases: ["salmon", "salmon fillet"], canon: { name: "salmon", category: "seafood", sold: "weight", gramsPerItem: 150 } },
  { aliases: ["cod", "haddock", "white fish", "hake"], canon: { name: "white fish", category: "seafood", sold: "weight", gramsPerItem: 150 } },
  { aliases: ["tuna"], canon: { name: "tuna", category: "seafood", sold: "weight" } },
  { aliases: ["prawn", "shrimp", "king prawn"], canon: { name: "prawns", category: "seafood", sold: "weight", gramsPerCup: 145 } },
  { aliases: ["sardine"], canon: { name: "sardines", category: "seafood", sold: "count", gramsPerItem: 40 } },
  { aliases: ["anchovy", "anchovies"], canon: { name: "anchovies", category: "pantry", sold: "pack" } },

  // staples (bought as pack/jar — qty hidden)
  { aliases: ["olive oil", "extra-virgin olive oil", "vegetable oil", "avocado oil", "sunflower oil", "sesame oil"], canon: { name: "cooking oil", category: "pantry", sold: "pack" } },
  { aliases: ["salt", "pepper", "black pepper", "sea salt"], canon: { name: "salt & pepper", category: "pantry", sold: "pack" } },
  { aliases: ["rice", "basmati rice", "brown rice", "white rice"], canon: { name: "rice", category: "pantry", sold: "weight", gramsPerCup: 185 } },
  { aliases: ["pasta", "spaghetti", "penne", "noodle"], canon: { name: "pasta", category: "pantry", sold: "weight", gramsPerCup: 100 } },
  { aliases: ["lentil", "red lentil", "split lentil", "green lentil", "cooked lentil", "packet lentil"], canon: { name: "lentils", category: "pantry", sold: "weight", gramsPerCup: 200, gramsPerItem: 250 } },
  { aliases: ["chickpea", "garbanzo"], canon: { name: "chickpeas", category: "pantry", sold: "weight", gramsPerCup: 160 } },
  { aliases: ["flour", "plain flour", "self-raising flour"], canon: { name: "flour", category: "pantry", sold: "pack" } },
  { aliases: ["honey", "runny honey", "maple syrup", "sugar"], canon: { name: "honey/sugar", category: "pantry", sold: "pack" } },
  { aliases: ["soy sauce", "teriyaki sauce", "fish sauce", "oyster sauce", "coconut aminos", "vinegar", "curry paste", "tomato paste", "mustard", "tahini"], canon: { name: "", category: "pantry", sold: "pack" } },
  { aliases: ["bread", "ciabatta", "loaf", "pitta", "tortilla", "wrap"], canon: { name: "bread", category: "pantry", sold: "pack" } },
  { aliases: ["sesame seed", "spice", "seed", "paprika", "cumin", "oregano", "ras el hanout", "garam masala"], canon: { name: "", category: "pantry", sold: "pack" } },
];

const PREP = /\b(sliced|diced|chopped|minced|grated|shredded|crushed|cubed|cut|fresh|dried|cooked|raw|peeled|trimmed|halved|quartered|roasted|scraped|finely|roughly|thinly|small|large|medium|baby|mixed[- ]?colou?r|heritage|ripe|skinless|boneless|for garnish|for frying|to serve|to taste|extra|plus)\b/gi;

function stripToCore(raw: string): string {
  let n = raw.toLowerCase();
  n = n.replace(/\([^)]*\)/g, " ").replace(/,.*$/, "");
  n = n.replace(/\bstrands?\b.*?\bfrom\b/g, "").replace(/\bfrom \d.*$/g, "");
  n = n.replace(/^[\s\d½¼¾⅓⅔.,x×-]+/, "");
  // leading measure words ("heaped tablespoons fennel seeds" -> "fennel seeds")
  n = n.replace(/^(heaped|level|rounded|\s)*(tablespoons?|teaspoons?|tbsp|tsp|cups?|pinch(es)?|handful|sprigs?|cloves?|sachets?|packets?|tins?|jars?|cans?|bunch(es)?|heads?)\s+(of\s+)?/gi, "");
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

const titleCase = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

// Convert one recipe ingredient into a raw buy-item.
export function toBuyItem(
  rawName: string, quantity: number | null, unit: string, fallbackCat: string,
): BuyItem {
  const core = stripToCore(rawName);
  const canon = lookup(core);
  const u = (unit || "").toLowerCase();

  if (!canon) {
    // unknown: keep cleaned name, drop cup/lb weirdness to a count-ish guess
    return { name: core || rawName.toLowerCase(), display: titleCase(core || rawName),
      quantity: null, unit: "", category: fallbackCat, staple: fallbackCat === "pantry" };
  }
  if (canon.sold === "pack" || !canon.name) {
    return { name: canon.name || core, display: titleCase(canon.name || core),
      quantity: null, unit: "", category: "pantry", staple: true };
  }

  // resolve quantity into the canonical sold-unit
  let grams: number | null = null;
  if (quantity != null) {
    if (u === "g") grams = quantity;
    else if (u === "kg") grams = quantity * 1000;
    else if (u === "lb" || u === "lbs") grams = quantity * 454;
    else if (u === "oz") grams = quantity * 28;
    else if ((u === "cup" || u === "cups") && canon.gramsPerCup) grams = quantity * canon.gramsPerCup;
    else if ((u === "" || u === "un" || u === "x") && canon.gramsPerItem) grams = quantity * canon.gramsPerItem;
  }

  if (canon.sold === "count") {
    // sell as whole items: prefer count if we had a count, else derive from grams
    let qty: number | null = null;
    if ((u === "" || u === "un" || u === "x") && quantity != null) qty = Math.ceil(quantity);
    else if (grams != null && canon.gramsPerItem) qty = Math.max(1, Math.ceil(grams / canon.gramsPerItem));
    else if (quantity != null) qty = Math.max(1, Math.ceil(quantity));
    return { name: canon.name, display: titleCase(canon.name), quantity: qty, unit: "",
      category: canon.category, staple: false };
  }

  // sold by weight → grams, rounded sensibly
  let g = grams;
  if (g == null && quantity != null && canon.gramsPerItem) g = quantity * canon.gramsPerItem;
  if (g == null) return { name: canon.name, display: titleCase(canon.name), quantity: null,
    unit: "", category: canon.category, staple: false };
  const rounded = g >= 1000 ? Math.round(g / 250) * 250 : Math.max(50, Math.round(g / 50) * 50);
  if (rounded >= 1000)
    return { name: canon.name, display: titleCase(canon.name), quantity: Math.round(rounded / 250) / 4,
      unit: "kg", category: canon.category, staple: false };
  return { name: canon.name, display: titleCase(canon.name), quantity: rounded, unit: "g",
    category: canon.category, staple: false };
}
