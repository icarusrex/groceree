// Recipe import from a web page's schema.org Recipe JSON-LD (what WordPress
// recipe plugins publish). Pure functions: the Worker's "add from link" and the
// bulk import script both use them, and the saved result still goes through the
// allergen check in /api/recipes.

import { toBuyItem } from "./normalise.ts";

const decode = (s: string) => s
  .replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#?apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();

const isRecipe = (n: any) => n && (n["@type"] === "Recipe" || (Array.isArray(n["@type"]) && n["@type"].includes("Recipe")));

// The first Recipe node in any JSON-LD block of the page (handles @graph and arrays).
export function findRecipeLd(html: string): any | null {
  const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const b of blocks) {
    let data: any;
    try { data = JSON.parse(b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "")); } catch { continue; }
    const stack = [data];
    while (stack.length) {
      const n = stack.pop();
      if (Array.isArray(n)) stack.push(...n);
      else if (n && typeof n === "object") {
        if (isRecipe(n)) return n;
        if (n["@graph"]) stack.push(n["@graph"]);
      }
    }
  }
  return null;
}

const FRAC: Record<string, number> = { "½": .5, "¼": .25, "¾": .75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": .125, "⅜": .375, "⅝": .625, "⅞": .875 };
const UNITS = /^(cups?|c\.|tablespoons?|tbsps?|tbs|T|teaspoons?|tsps?|t|pounds?|lbs?|ounces?|oz|grams?|g|kilograms?|kg|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l|cans?|tins?|jars?|cloves?|heads?|bunch(?:es)?|pinch(?:es)?|dash(?:es)?|slices?|packages?|pkgs?|packets?|sprigs?|stalks?|ribs?|fillets?|handfuls?|quarts?|qt|pints?|pt|sticks?)\.?\b/i;

// "2 1/2 cups chopped carrots" → { quantity: 2.5, unit: "cups", name: "chopped carrots" }
export function parseIngredientLine(raw: string): { name: string; quantity: number | null; unit: string } {
  let s = decode(raw).replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, (c) => ` ${FRAC[c]} `).replace(/\s+/g, " ").trim();
  let quantity: number | null = null;
  const num = /^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+)|\s+(0?\.\d+)|\/(\d+))?(?:\s*(?:-|–|to)\s*[\d./]+(?:\s+\d+\/\d+)?)?\s*/;
  const m = s.match(num);
  if (m) {
    let q = Number(m[1]);
    if (m[2]) q += Number(m[2]) / Number(m[3]);
    else if (m[4]) q += Number(m[4]);
    else if (m[5]) q = q / Number(m[5]);
    quantity = Math.round(q * 1000) / 1000;
    s = s.slice(m[0].length);
  }
  // "1 (14-ounce) can coconut milk": the package size is a note, the can is the unit
  s = s.replace(/^\([^)]*\)\s*/, "");
  let unit = "";
  const u = s.match(UNITS);
  if (u && quantity != null) { unit = u[1].toLowerCase(); s = s.slice(u[0].length).trim(); }
  s = s.replace(/^of\s+/i, "").replace(/\s*\((optional|see note[^)]*)\)\s*/gi, " ").trim();
  return { name: s || decode(raw), quantity, unit };
}

const minutes = (iso: unknown): number | null => {
  const m = typeof iso === "string" && iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  const t = Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return t > 0 ? t : null;
};

const steps = (ins: any): string[] => {
  if (!ins) return [];
  if (typeof ins === "string") return decode(ins).split(/(?<=\.)\s+(?=[A-Z])/).filter(Boolean);
  if (Array.isArray(ins)) return ins.flatMap(steps);
  if (ins.itemListElement) return steps(ins.itemListElement);
  if (ins.text) return [decode(String(ins.text))];
  return [];
};

const first = (v: any): string => Array.isArray(v) ? first(v[0]) : typeof v === "object" && v ? String(v.url || v["@id"] || "") : String(v ?? "");

const PROTEIN: [string, RegExp][] = [
  ["fish", /\b(salmon|cod|tuna|trout|tilapia|halibut|haddock|sea bass|bass|sardines?|mackerel|anchov\w*|fish|shrimp|prawns?|scallops?|mussels?|clams?|squid|octopus|crab|lobster)\b/i],
  ["chicken", /\bchicken\b/i], ["turkey", /\bturkey\b/i], ["duck", /\bduck\b/i],
  ["beef", /\b(beef|steak|brisket|chuck|sirloin|veal|bison)\b/i],
  ["pork", /\b(pork|bacon|ham|prosciutto|chorizo|sausages?|pancetta)\b/i],
  ["lamb", /\b(lamb|mutton|goat)\b/i],
];

// A JSON-LD Recipe → the shape /api/recipes stores. null when it has no usable ingredients.
export function recipeFromLd(ld: any, url: string) {
  const ingredients = (Array.isArray(ld?.recipeIngredient) ? ld.recipeIngredient : [])
    .map((l: unknown) => String(l ?? "")).filter((l: string) => l.trim() && !/^[A-Z][A-Z\s:]+:?$/.test(l.trim()))
    .map((l: string) => {
      const p = parseIngredientLine(l);
      const b = toBuyItem(p.name, p.quantity, p.unit, "pantry");
      return { ...p, category: b.category === "other" ? "pantry" : b.category };
    });
  if (!ingredients.length) return null;
  // The main protein is the first ingredient line naming one, ignoring broths,
  // sauces and fats ("fish sauce" in a chicken curry, "bacon fat" for frying).
  const lines = ingredients.map((i: any) => i.name).filter((n: string) => !/\b(broth|stock|sauce|fat|lard|gelatin|collagen|bouillon)\b/i.test(n));
  let protein = "none";
  for (const n of lines) { const hit = PROTEIN.find(([, re]) => re.test(n)); if (hit) { protein = hit[0]; break; } }
  const yieldN = Number(String(first(ld.recipeYield)).match(/\d+/)?.[0]);
  return {
    name: decode(String(ld.name || "Imported recipe")).slice(0, 120),
    description: decode(String(ld.description || "")).slice(0, 300) || null,
    cuisine: decode(first(ld.recipeCuisine)).toLowerCase() || null,
    total_time: minutes(ld.totalTime) ?? ((minutes(ld.prepTime) ?? 0) + (minutes(ld.cookTime) ?? 0) || 30),
    servings: yieldN > 0 && yieldN <= 20 ? yieldN : 4,
    primary_protein: protein,
    is_vegetarian: protein === "none",
    is_pescatarian: protein === "none" || protein === "fish",
    ingredients,
    instructions: steps(ld.recipeInstructions),
    image_url: first(ld.image) || null,
    source_url: url,
  };
}
