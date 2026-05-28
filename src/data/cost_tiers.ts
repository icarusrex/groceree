/**
 * Cost guideline for the meal planner.
 *
 * The planner's job is to favour genuinely CHEAP meals, not meals that merely
 * have something on sale. A flyer discount adjusts an item's value but cannot
 * turn a premium item into a cheap one — "lobster at 10% off is still lobster".
 *
 * Two things live here:
 *   1. COST_TIERS — a baseline "what's generally cheap" map (tier 1 cheapest →
 *      tier 4 premium). It does not need to be precise; it's a guideline.
 *   2. affordability() — turns (item, discount, season) into a 0..1 cheapness
 *      score the engine can use, applying the discount GUARDRAIL.
 *
 * The same heuristic is also exported as COST_INSTRUCTIONS (plain text) for use
 * inside the Gemini flyer-parsing / from-flyer meal-plan prompt.
 */

export type CostTier = 1 | 2 | 3 | 4; // 1 = cheap staple, 4 = premium/treat

interface TierRule { tier: CostTier; match: string[]; }

// Order matters: first match wins, so list specific/premium cuts before generic.
export const COST_TIERS: TierRule[] = [
  // ---- Tier 4: premium / treat-only — a small discount never makes these cheap
  { tier: 4, match: ["lobster", "scallop", "prawn", "shrimp", "king prawn", "monkfish",
                      "sea bass", "tuna steak", "swordfish", "fillet steak", "sirloin",
                      "ribeye", "rib-eye", "tenderloin", "duck breast", "venison",
                      "saffron", "pine nut", "parmesan", "parmigiano", "truffle",
                      "pancetta", "prosciutto", "chorizo", "feta", "halloumi",
                      "pesto", "sun-dried", "cashew", "pistachio", "almond"] },
  // ---- Tier 3: pricier proteins & out-of-the-ordinary produce
  { tier: 3, match: ["salmon", "cod", "haddock", "white fish", "beef", "steak",
                     "lamb", "duck", "pork chop", "bacon", "sausage", "cheese",
                     "mozzarella", "asparagus", "berries", "raspberr", "blueberr",
                     "avocado", "mushroom", "nuts", "olive oil", "wine"] },
  // ---- Tier 2: moderate everyday
  { tier: 2, match: ["chicken breast", "pork", "turkey", "fish", "yogurt", "yoghurt",
                     "milk", "butter", "egg", "bell pepper", "courgette", "zucchini",
                     "aubergine", "eggplant", "tomato", "broccoli", "spinach",
                     "green bean", "apple", "pear", "orange", "banana", "rice",
                     "pasta", "bread", "flour"] },
  // ---- Tier 1: cheap staples & bulk
  { tier: 1, match: ["chicken thigh", "chicken leg", "drumstick", "mince",
                     "ground beef", "ground turkey", "lentil", "chickpea", "bean",
                     "canned tomato", "tinned tomato", "potato", "onion", "carrot",
                     "cabbage", "leek", "frozen", "oats", "barley", "couscous"] },
];

const DEFAULT_TIER: CostTier = 2;

export function baseTier(itemName: string): CostTier {
  const n = itemName.toLowerCase();
  for (const rule of COST_TIERS) {
    if (rule.match.some((m) => n.includes(m))) return rule.tier;
  }
  return DEFAULT_TIER;
}

/**
 * THE GUARDRAIL.
 * effectiveTier shifts the baseline cheaper as the discount deepens — roughly
 * one whole tier per ~25% off — but two rules protect against fake bargains:
 *   • Tier-4 items get NO discount benefit until the cut is steep (>= 40%).
 *   • The result is floored at tier 1 (can't get cheaper than a staple).
 */
export function effectiveTier(itemName: string, discountPct = 0): number {
  const base = baseTier(itemName);
  if (base === 4 && discountPct < 0.4) return 4; // lobster at 10% off === lobster
  const shift = discountPct / 0.25;              // 25% off ≈ one tier cheaper
  return Math.max(1, base - shift);
}

/**
 * Cheapness score 0..1 (1 = very cheap) the engine multiplies into a recipe's
 * cost factor. `seasonScore` (0..1, from seasonality.pt.ts) nudges produce that
 * is locally in-season cheaper still.
 */
export function affordability(
  itemName: string,
  opts: { discountPct?: number; seasonScore?: number } = {},
): number {
  const { discountPct = 0, seasonScore = 0 } = opts;
  const eff = effectiveTier(itemName, discountPct);
  let cheapness = (4 - eff) / 3;            // tier1→1.0, tier4→0.0
  cheapness += 0.15 * seasonScore;          // in-season produce: small extra nudge
  return Math.max(0, Math.min(1, cheapness));
}

/** Average affordability across a recipe's ingredients (engine cost factor). */
export function recipeAffordability(
  ingredients: { name: string }[],
  deals: Record<string, number> = {},    // itemName(lower) -> discountPct from flyers
  seasonScoreFor: (name: string) => number = () => 0,
): number {
  if (!ingredients.length) return 0.5;
  const scores = ingredients.map((i) =>
    affordability(i.name, {
      discountPct: deals[i.name.toLowerCase()] ?? 0,
      seasonScore: seasonScoreFor(i.name),
    }),
  );
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Plain-language version of the same guideline — paste into the Gemini prompt
 * for "build a meal plan from these flyers" so the model reasons the same way.
 */
export const COST_INSTRUCTIONS = `
You are optimising a weekly meal plan for a busy family on a budget in Portugal.

What is generally CHEAP (prefer these):
- Staple proteins: chicken thighs/legs, minced/ground meat, eggs, tinned beans,
  lentils, chickpeas, frozen fish.
- Staple carbs: potatoes, rice, pasta, oats, bread.
- Cheap veg: onions, carrots, cabbage, leeks, frozen vegetables, tinned tomatoes,
  and whatever is in season locally (in-season produce is cheaper and better).

What is generally EXPENSIVE (use sparingly, only if a treat is wanted):
- Premium seafood: lobster, prawns/shrimp, scallops, fresh tuna/sea bass.
- Premium meat cuts: steak (sirloin/ribeye/fillet), lamb, duck.
- Specialty items: pine nuts, saffron, aged/specialty cheeses, truffle.

CRITICAL rule about discounts:
- A discount makes an item MORE attractive, but does NOT make an expensive item
  cheap. Lobster at 10% off is still an expensive ingredient — do NOT build the
  plan around it. Only treat a premium item as a good deal if the discount is
  large (40%+). Always prefer ingredients that are cheap to begin with.
- Roughly: every 25% off moves an item one step down the price ladder, but a
  staple can't get cheaper than a staple, and a premium item needs a steep cut
  before it counts as good value.

Use the flyer discounts as ONE input. Seasonality, ease of cooking, what's in the
pantry, and variety all matter too. Aim for meals that are cheap, easy for a busy
family, and use what's on sale only when it's genuinely good value.
`.trim();
