// Allergen detection from ingredient text — English recipe lines and Portuguese
// shop/flyer names. These are ALLERGIES in this household (gluten, dairy, soy,
// egg), so it errs toward "contains": a false alarm hides one recipe, a miss
// feeds someone something they react to. The imported recipe flags proved
// unreliable (turkey dishes tagged vegetarian), so the planner checks these on
// top of them rather than trusting them.
//
// A line with an allergen word is still fine when it names the safe version
// ("gluten-free flour", "coconut cream", "vegan mayo") or offers one as the
// alternative ("heavy cream or coconut cream", "ghee or avocado oil").
// Lactose-free is NOT dairy-free (still milk protein). Tamari is gluten-free
// but still soy. Stock/broth isn't flagged (it's in dozens of recipes and the
// answer is homemade stock) — the shopping list carries that warning instead.

export type Allergen = "gluten" | "dairy" | "egg" | "soy";
export const ALLERGENS: Allergen[] = ["gluten", "dairy", "egg", "soy"];
export const DIET_FOR: Record<Allergen, string> = { gluten: "gluten_free", dairy: "dairy_free", egg: "egg_free", soy: "soy_free" };

const CONTAINS: Record<Allergen, RegExp> = {
  gluten: /\b(bread|breadcrumbs?|panko|pasta|spaghetti|penne|rigatoni|fusilli|macaroni|linguine|tagliatelle|farfalle|orzo|lasagn\w*|gnocchi|noodles?|couscous|bulgu?r|barley|rye|spelt|farro|semolina|seitan|wheat|flour|crackers?|biscuits?|cakes?|pastry|croissants?|pizza|baguette|buns?|croutons?|tortillas?|pitta|pita|wraps?|soy sauce|teriyaki|hoisin|oyster sauce|beer|malt|worcestershire|roux|p[aã]o|massas?|esparguete|farinha|bolachas?|bolos?|cuscuz|cevada|centeio|trigo|tostas?|torradas?|cerveja|malte)\b/i,
  dairy: /\b(milk|cheeses?|cheddar|parmesan|parmigiano|pecorino|mozzarella|feta|ricotta|halloumi|paneer|gouda|brie|mascarpone|provolone|cotija|queso|monterey jack|butter|buttermilk|ghee|cream|cr[eè]me fra[iî]che|yogh?urts?|kefir|skyr|quark|whey|casein|custard|ice cream|chocolate|leite|queijos?|iogurtes?|manteiga|natas?|requeij[aã]o|gelados?|lacticin\w*)\b/i,
  egg: /\b(eggs?|egg (whites?|yolks?)|mayo|mayonnaise|maionese|aioli|meringue|merengue|custard|brioche|hollandaise|b[eé]arnaise|ovos?|gemas?)\b/i,
  soy: /\b(soy|soya|soja|tamari|tofu|tempeh|miso|edamame|teriyaki|hoisin|shoyu|lecithin|lecitina)\b/i,
};

// Named safe versions / explicit alternatives, per allergen.
const SAFE: Record<Allergen, RegExp> = {
  gluten: /gluten[- ]free|sem gl[uú]ten|rice (noodles?|pasta|flour|paper)|chickpea|lentil pasta|corn tortillas?|milho|almond flour|coconut flour|tapioca|cassava|buckwheat|arrowroot|corn ?flour|corn ?starch|potato starch|massa de piment[aã]o|pepper paste|spaghetti squash|cauli(flower)?[- ]rice|coconut aminos|grain[- ]free|\bor lettuce\b/i,
  dairy: /dairy[- ]free|non[- ]dairy|vegan|plant[- ]based|sem leite|coconut|almond|\boat\b|cashew|peanut butter|nut butter|almond butter|sunflower butter|seed butter|apple butter|cocoa butter|butter (beans?|lettuce|leaves)|\bor (avocado|olive|coconut|vegetable|sunflower)? ?oil\b|(avocado|olive|coconut|vegetable|sunflower) oil,? or\b|oil of choice|leite (de )?coco|feij[aã]o manteiga|cream of tartar/i,
  egg: /eggplant|egg[- ]free|vegan mayo|sem ovo|flax egg|chia egg|aquafaba|egg roll/i,
  soy: /soy[- ]free|sem soja|coconut aminos/i,
};

export function containsAllergen(text: string, a: Allergen): boolean {
  const t = text.normalize("NFKC");
  return CONTAINS[a].test(t) && !SAFE[a].test(t);
}

// Allergens present in a recipe, with the ingredient line that triggered each.
export function recipeAllergens(r: { ingredients: { name: string }[] }): Map<Allergen, string> {
  const found = new Map<Allergen, string>();
  for (const ing of r.ingredients || []) {
    for (const a of ALLERGENS) if (!found.has(a) && containsAllergen(ing.name, a)) found.set(a, ing.name);
  }
  return found;
}

// Which allergens the user's diet excludes ("gluten_free" → gluten, …).
export const excludedAllergens = (diet: string[]): Allergen[] =>
  ALLERGENS.filter((a) => diet.includes(DIET_FOR[a]));

// The allergens in `r` that this diet rules out (empty = safe for them).
export function dietConflicts(r: { ingredients: { name: string }[] }, diet: string[]): Map<Allergen, string> {
  const all = recipeAllergens(r), out = new Map<Allergen, string>();
  for (const a of excludedAllergens(diet)) if (all.has(a)) out.set(a, all.get(a)!);
  return out;
}
