// Deterministic deal analysis for a parsed flyer. No AI — everything here is
// computed from the persisted price rows (price / normal_price / discount) plus
// the user's recipe ingredients. The flyer's Gemini one-liner is a vibe; this is
// the part that actually helps decide what to buy:
//   - stock_up   : non-perishable (pantry) + real discount → buy multiples
//   - cook_fresh : perishable (produce/meat/fish/dairy) + discount → buy for now
//   - for_recipes: deal items that appear in many of the user's recipes
//   - top_savings: biggest absolute € off per unit (supporting detail)
//   - theme      : which category the discounts cluster on this week
import { categorize, type FoodCat } from "./_flyer.ts";

export interface DealRow {
  item_name: string;
  item_name_pt?: string | null;
  unit?: string | null;
  price: number | null;
  normal_price?: number | null;
  discount?: number | null;
}

export interface DealPick {
  name: string;
  unit: string | null;
  price: number | null;
  normal_price: number | null;
  discount: number | null; // 0..1
  saving: number | null;    // € per unit
  recipes?: number;         // how many of the user's recipes use it
}

export interface FlyerAnalysis {
  theme: string | null;
  top_pick: DealPick | null;   // the single best buy for THIS user (highlighted)
  for_you: DealPick[];         // cheapest food you'll actually eat (works w/o discounts)
  stock_up: DealPick[];        // non-perishable + discount → buy multiples
  cook_fresh: DealPick[];      // perishable + discount → buy for this week
}

const FRESH: FoodCat[] = ["produce", "meat", "fish", "dairy"];
// Alcohol / soft drinks: categorize() files these under "pantry" (wine, beer) or
// matches stray tokens ("Dr Pepper" → black pepper recipes), polluting both the
// stock-up list and recipe matching. They aren't meal ingredients — drop them.
const BOOZE = /\bwine\b|\bbeer\b|whisk|vodka|\bgin\b|\brum\b|liqueur|licor|spirit|espirituosa|aguardente|brandy|cognac|conhaque|\bport\b|porto\b|moscatel|champagne|espumante|prosecco|sangria|scotch|bourbon|tequila|aperol|aperitiv|vermouth|martini|cerveja|vinho|\bbebida\b|cola\b|dr\.?\s*pepper|tonic|guaran|energ(y|etic)|red bull|monster\b/i;
// Snacks / confectionery: not meal ingredients a home cook plans around, and the
// messy structured-feed names ("Buffalo Chicken Wings Pringles") cause false
// recipe matches. Exclude from the personalised picks.
const JUNK = /pringles|doritos|crisps|\bchips\b|tortilla|batata frita|\blays?\b|\bsnack|gomas|gummy|\bcandy|rebucad|lollip|chewing|marshmallow|wafer|\bbar\b|chocolate bar|bombom|\bbolacha|biscuit|\bcookie|\bdoce\b|gelado|ice cream|sorvete|sobremesa|ben.?jerry|haagen|magnum|cornetto|\btempero|maggi|knorr/i;
// Tokens too generic to mean anything when matching a deal to recipes. Includes
// product descriptors (extra, original, forte…) that otherwise create phantom
// matches — e.g. "extra" hits every "extra virgin olive oil" recipe, making an
// unrelated "Arroz Extra Longo" look like it's in 50 of your recipes.
const STOP = new Set(["with", "fresh", "from", "style", "your", "good", "mini",
  "large", "small", "pack", "value", "brand", "white", "brown", "free", "plus",
  "extra", "original", "longo", "forte", "especial", "light", "classic", "sabor",
  "tipo", "novo", "nova", "selecao", "premium", "natural"]);

// Per-token recipe signal: `count` = how many recipes use the token (honest,
// for display); `weight` = the same, but favourites/cooked recipes count for
// more (the habit signal used for ranking; grows as that data accumulates).
type TokenStat = { count: number; weight: number };
export type IngredientIndex = Map<string, TokenStat>;

// Build the index across the user's recipes. One token can appear in many
// recipes; we count distinct recipes per token (not repeats within a recipe).
export async function buildIngredientIndex(
  db: D1Database, user: string,
): Promise<IngredientIndex> {
  const idx: IngredientIndex = new Map();
  const { results } = await db.prepare(
    `SELECT r.ingredients AS ingredients,
            COALESCE(s.is_favorite,0) AS fav, COALESCE(s.times_cooked,0) AS cooked
       FROM recipes r
       LEFT JOIN recipe_state s ON s.recipe_id = r.id AND s.user_id = ?`,
  ).bind(user).all();
  for (const row of results as any[]) {
    const weight = 1 + 2 * (row.fav ? 1 : 0) + Math.min(Number(row.cooked) || 0, 3);
    let ings: any[];
    try { ings = JSON.parse(row.ingredients || "[]"); } catch { continue; }
    const toks = new Set<string>();
    for (const it of ings) {
      for (const tok of String(it?.name || "").toLowerCase().match(/[a-z]+/g) || []) {
        if (tok.length <= 3 || STOP.has(tok)) continue;
        toks.add(tok);
      }
    }
    for (const tok of toks) {
      const cur = idx.get(tok) || { count: 0, weight: 0 };
      cur.count += 1; cur.weight += weight;
      idx.set(tok, cur);
    }
  }
  return idx;
}

// Match a deal name to its strongest recipe-ingredient token. Earlier tokens are
// weighted higher: product names lead with the actual item ("Arroz Basmati" =
// rice; "Fiambre da Perna" = ham), while a trailing flavour word ("…Crispy
// Chicken Maggi" seasoning) is a weak signal. We pick the best *position-decayed*
// match but report that token's true recipe count (display) and weight (ranking).
function recipeHits(name: string, idx: IngredientIndex): TokenStat {
  let best: TokenStat = { count: 0, weight: 0 };
  let bestEff = 0;
  const toks = name.toLowerCase().match(/[a-z]+/g) || [];
  toks.forEach((tok, i) => {
    if (tok.length <= 3 || STOP.has(tok)) return;
    const s = idx.get(tok);
    if (!s) return;
    const eff = s.weight / (1 + 0.5 * i); // decay by position
    if (eff > bestEff) { bestEff = eff; best = s; }
  });
  return best;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const THEME_LABEL: Record<FoodCat, string> = {
  pantry: "Pantry stock-up week",
  fish: "Strong fish deals",
  produce: "Cheap fresh produce",
  meat: "Meat deals this week",
  dairy: "Dairy deals this week",
};

export function analyzeFlyer(rows: DealRow[], idx: IngredientIndex): FlyerAnalysis {
  type Enriched = DealPick & { cat: FoodCat | null; rank: number; score: number };
  const items: Enriched[] = [];
  for (const r of rows) {
    const price = r.price;
    const normal = r.normal_price ?? null;
    // Trust the stored discount; else derive it from the price pair.
    let disc = r.discount ?? null;
    if ((disc == null || disc <= 0) && normal && price && normal > price) disc = (normal - price) / normal;
    const saving = normal && price && normal > price ? round2(normal - price) : null;
    const excluded = BOOZE.test(r.item_name) || JUNK.test(r.item_name);
    const cat = excluded ? null : categorize(r.item_name);
    // Only recipe-match real food. Non-food / snacks shouldn't borrow a stray
    // ingredient token ("Buffalo Chicken" crisps ≠ chicken).
    const hit = cat ? recipeHits(r.item_name, idx) : { count: 0, weight: 0 };
    // Personalised value score, designed to work with OR without discount data:
    //   - rank      : how likely you are to eat it (recipe ingredient weight)
    //   - discount  : on-sale items rank higher where we know the discount
    //   - 1/√price  : pulls the *cheapest* relevant items up (your "cheapest" ask)
    // Structured feeds have no discount, so there the score is rank × cheapness.
    const p = Math.max(price ?? 99, 0.3);
    // Recipe weight where we have a match; else a cheapness baseline for any real
    // food. The baseline matters on Portuguese structured feeds (Continente/Pingo)
    // whose names don't overlap the English recipe index — there the cheapest
    // categorised staple should still surface, just ranked below true matches.
    const base = hit.weight > 0 ? hit.weight : (cat ? 1 : 0);
    const score = base > 0 ? base * (0.25 + (disc ?? 0)) / Math.sqrt(p) : 0;
    items.push({
      name: r.item_name,
      unit: r.unit ?? null,
      price, normal_price: normal,
      discount: disc != null ? round2(disc) : null,
      saving,
      recipes: hit.count || undefined,
      cat, rank: hit.weight, score,
    });
  }

  const strip = (e: Enriched): DealPick => ({
    name: e.name, unit: e.unit, price: e.price, normal_price: e.normal_price,
    discount: e.discount, saving: e.saving, recipes: e.recipes,
  });

  // Personalised ranking — cheapest food you're most likely to eat. Works for
  // every store, discount data or not. This is the spine of the card.
  const ranked = items.filter((e) => e.score > 0).sort((a, b) => b.score - a.score);
  const top_pick = ranked.length ? strip(ranked[0]) : null;
  const for_you = ranked.slice(1, 6).map(strip);

  // Supplementary lenses, only meaningful when we know discounts.
  const stock_up = items
    .filter((e) => e.cat === "pantry" && (e.discount ?? 0) >= 0.15)
    .sort((a, b) => (b.saving ?? 0) - (a.saving ?? 0) || (b.discount ?? 0) - (a.discount ?? 0))
    .slice(0, 4).map(strip);

  const cook_fresh = items
    .filter((e) => e.cat && FRESH.includes(e.cat) && (e.discount ?? 0) > 0)
    .sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0))
    .slice(0, 4).map(strip);

  // Theme: which category the discounts (≥15%) cluster on.
  const counts = new Map<FoodCat, number>();
  for (const e of items) {
    if (!e.cat || (e.discount ?? 0) < 0.15) continue;
    counts.set(e.cat, (counts.get(e.cat) || 0) + 1);
  }
  let theme: string | null = null;
  let top: [FoodCat, number] | null = null;
  for (const [c, n] of counts) if (!top || n > top[1]) top = [c, n];
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (top && total >= 4 && top[1] / total >= 0.4) theme = THEME_LABEL[top[0]];

  return { theme, top_pick, for_you, stock_up, cook_fresh };
}
