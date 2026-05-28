// The meal-plan engine. Pure functions, runs in node, the browser, or a Worker.
//
// Pipeline:
//   1. eligibleRecipes() — hard filters (diet, hidden, excluded cuisine).
//   2. scoreRecipe()     — season × affordability × ease × pantry, then a
//                          learning multiplier (favorite ↑, skipped ↓, recency ↓).
//   3. generatePlan()    — fills 7×{lunch,dinner}; big dinners auto-backfill the
//                          next day's lunch as leftovers; variety penalties keep
//                          proteins/cuisines from repeating.
//   4. buildShoppingList() — aggregates non-leftover meals, scaled to household.

import {
  recipeSeasonScore,
  ingredientSeasonScore,
} from "../data/seasonality.pt.ts";
import { recipeAffordability } from "../data/cost_tiers.ts";
import type {
  Recipe, Settings, RecipeState, PlanItem, GenerateInput, Diet, Slot,
} from "./types.ts";

// ---- scoring weights (cost-leaning, but ease matters for a busy family) ----
const W = { season: 0.20, afford: 0.35, ease: 0.25, pantry: 0.20 };

// ---- deterministic jitter so regenerate gives variety but is reproducible ---
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- diet eligibility -------------------------------------------------------
function passesDiet(r: Recipe, diet: Diet[]): boolean {
  for (const d of diet) {
    if (d === "gluten_free" && !r.is_gluten_free) return false;
    if (d === "vegetarian" && !r.is_vegetarian) return false;
    if (d === "pescatarian" && !(r.is_vegetarian || r.is_pescatarian)) return false;
    if (d === "dairy_free" && !r.is_dairy_free) return false;
  }
  return true;
}

export function eligibleRecipes(recipes: Recipe[], settings: Settings,
                                states: Record<string, RecipeState>): Recipe[] {
  const ex = new Set(settings.exclude_cuisines.map((c) => c.toLowerCase()));
  return recipes.filter((r) => {
    if (states[r.id]?.is_hidden) return false;
    if (r.cuisine && ex.has(r.cuisine.toLowerCase())) return false;
    if (!passesDiet(r, settings.diet)) return false;
    return true;
  });
}

// ---- pantry match -----------------------------------------------------------
function pantryScore(r: Recipe, pantrySet: string[]): number {
  if (!pantrySet.length || !r.ingredients.length) return 0;
  let hits = 0;
  for (const ing of r.ingredients) {
    const n = ing.name.toLowerCase();
    if (pantrySet.some((p) => n.includes(p) || p.includes(n))) hits++;
  }
  return hits / r.ingredients.length;
}

// ---- learning multiplier ----------------------------------------------------
function learningWeight(st: RecipeState | undefined, today: Date): number {
  if (!st) return 1;
  let w = 1;
  if (st.is_favorite) w *= 1.6;
  w *= 1 + 0.08 * Math.min(st.times_cooked ?? 0, 5);
  w *= 1 - 0.15 * Math.min(st.times_skipped ?? 0, 3);
  if (st.last_cooked_at) {
    const days = (today.getTime() - new Date(st.last_cooked_at).getTime()) / 86400000;
    if (days < 7) w *= 0.25;        // cooked this week: strongly avoid
    else if (days < 21) w *= 0.7;   // recent-ish: mild avoid
  }
  return Math.max(0, w);
}

// ---- base (preference-independent) score 0..1 -------------------------------
export function baseScore(r: Recipe, input: Required<Pick<GenerateInput,
  "deals" | "month">> & { pantrySet: string[] }): number {
  const names = r.ingredients.map((i) => i.name);
  const season = recipeSeasonScore(names, input.month);
  const afford = recipeAffordability(
    r.ingredients, input.deals,
    (name) => ingredientSeasonScore(name, input.month),
  );
  const ease = r.ease_score;
  const pantry = pantryScore(r, input.pantrySet);
  return W.season * season + W.afford * afford + W.ease * ease + W.pantry * pantry;
}

export interface Scored { recipe: Recipe; base: number; score: number; }

export function scoreAll(input: GenerateInput): Scored[] {
  const month = input.month ?? new Date().getMonth() + 1;
  const deals = input.deals ?? {};
  const states = input.states ?? {};
  const pantrySet = (input.pantry ?? []).map((p) => p.toLowerCase().trim()).filter(Boolean);
  const today = new Date();
  const rng = mulberry32(input.seed ?? Math.floor(Math.random() * 1e9));

  const elig = eligibleRecipes(input.recipes, input.settings, states);
  return elig.map((r) => {
    const base = baseScore(r, { deals, month, pantrySet });
    const learn = learningWeight(states[r.id], today);
    const jitter = 0.85 + 0.3 * rng(); // ±15% so weeks differ
    return { recipe: r, base, score: base * learn * jitter };
  }).sort((a, b) => b.score - a.score);
}

// ---- plan generation --------------------------------------------------------
const VARIETY_PROTEIN_PENALTY = 0.55; // same protein as yesterday's cook
const VARIETY_CUISINE_PENALTY = 0.8;

export function generatePlan(input: GenerateInput): PlanItem[] {
  const household = Math.max(1, input.settings.household_size);
  const maxMin = input.settings.max_active_minutes;
  const autoLeftover = input.settings.leftover_strategy !== "off";
  const ranked = scoreAll(input);

  const used = new Set<string>();
  const items: PlanItem[] = [];
  let lastProtein = "";
  let lastCuisine = "";

  // helper to pick the best not-yet-used recipe with variety + time penalties
  function pick(filter: (r: Recipe) => boolean): Scored | null {
    let best: Scored | null = null;
    let bestAdj = -1;
    for (const s of ranked) {
      if (used.has(s.recipe.id) || !filter(s.recipe)) continue;
      let adj = s.score;
      if (s.recipe.primary_protein !== "none" &&
          s.recipe.primary_protein === lastProtein) adj *= VARIETY_PROTEIN_PENALTY;
      if (s.recipe.cuisine && s.recipe.cuisine === lastCuisine) adj *= VARIETY_CUISINE_PENALTY;
      if (maxMin && s.recipe.total_time > maxMin) adj *= 0.4;
      if (adj > bestAdj) { bestAdj = adj; best = s; }
    }
    return best;
  }

  // grid: for each day fill dinner first, then lunch (leftover or fresh)
  const dinner: (Scored | null)[] = Array(8).fill(null); // 1..7
  const lunch: (PlanItem | null)[] = Array(8).fill(null);

  for (let day = 1; day <= 7; day++) {
    // prefer dinners that yield leftovers (servings cover a 2nd household meal)
    let choice = autoLeftover
      ? pick((r) => r.servings >= 2 * household)
      : null;
    if (!choice) choice = pick(() => true);
    if (!choice) break;
    used.add(choice.recipe.id);
    dinner[day] = choice;
    lastProtein = choice.recipe.primary_protein;
    lastCuisine = choice.recipe.cuisine ?? "";
    items.push({
      day_of_week: day, slot: "dinner", recipe_id: choice.recipe.id,
      is_leftover: false, leftover_of: null, servings: household,
    });
  }

  for (let day = 1; day <= 7; day++) {
    // does yesterday's dinner have spare servings for today's lunch?
    const prev = dinner[day - 1];
    if (autoLeftover && prev && prev.recipe.servings >= 2 * household) {
      lunch[day] = {
        day_of_week: day, slot: "lunch", recipe_id: prev.recipe.id,
        is_leftover: true,
        leftover_of: { day_of_week: day - 1, slot: "dinner" },
        servings: household,
      };
      continue;
    }
    // otherwise a fresh, quick lunch (bias to easy + small)
    lastProtein = day > 1 ? (dinner[day - 1]?.recipe.primary_protein ?? "") : "";
    lastCuisine = day > 1 ? (dinner[day - 1]?.recipe.cuisine ?? "") : "";
    const fresh = pick((r) => r.ease_score >= 0.6) ?? pick(() => true);
    if (fresh) {
      used.add(fresh.recipe.id);
      lunch[day] = {
        day_of_week: day, slot: "lunch", recipe_id: fresh.recipe.id,
        is_leftover: false, leftover_of: null, servings: household,
      };
    }
  }

  for (let day = 1; day <= 7; day++) if (lunch[day]) items.push(lunch[day]!);
  return items.sort((a, b) => a.day_of_week - b.day_of_week ||
    (a.slot === "lunch" ? -1 : 1));
}

// ---- shopping list ----------------------------------------------------------
export interface ShoppingItem {
  name: string; category: string; unit: string; quantity: number | null; recipes: string[];
}

export function buildShoppingList(plan: PlanItem[], recipes: Recipe[],
                                  household: number): ShoppingItem[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const agg = new Map<string, ShoppingItem>();
  for (const item of plan) {
    if (item.is_leftover || !item.recipe_id) continue; // leftovers cook nothing new
    const r = byId.get(item.recipe_id);
    if (!r) continue;
    const scale = (item.servings || household) / (r.servings || household);
    for (const ing of r.ingredients) {
      const unit = ing.unit_norm ?? ing.unit ?? "";
      const key = `${ing.name.toLowerCase()}|${unit}`;
      const ex = agg.get(key);
      const q = ing.quantity != null ? ing.quantity * scale : null;
      if (ex) {
        if (q != null) ex.quantity = (ex.quantity ?? 0) + q;
        if (!ex.recipes.includes(r.name)) ex.recipes.push(r.name);
      } else {
        agg.set(key, {
          name: ing.name, category: ing.category, unit,
          quantity: q != null ? q : null, recipes: [r.name],
        });
      }
    }
  }
  return [...agg.values()].sort((a, b) =>
    a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

// ---- human-sensible shopping amounts ---------------------------------------
// "1.5 tbsp peanut butter" is nonsense on a shopping list. Pantry staples and
// tiny seasoning amounts are shown without a quantity (you buy a jar/pack);
// real buy-items round to sensible increments.
export function tidyAmount(item: ShoppingItem): { text: string; staple: boolean } {
  const u = (item.unit || "").toLowerCase();
  const q = item.quantity;
  const tiny = ["tsp", "tbsp", "pinch", "clove"].includes(u);
  // pantry condiments/spices, or anything measured in tiny units → staple, no qty
  if (item.category === "pantry" || tiny) return { text: "", staple: true };
  if (q == null) return { text: "", staple: false };
  let n = q, unit = u;
  if (u === "g") { n = Math.max(50, Math.ceil(q / 50) * 50); }
  else if (u === "kg") { n = Math.ceil(q * 4) / 4; }
  else if (u === "cup" || u === "cups") { n = Math.max(0.5, Math.round(q * 2) / 2); unit = "cup"; }
  else { n = Math.ceil(q); unit = u; } // counts / un
  const num = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "");
  return { text: `${num}${unit ? " " + unit : ""}`, staple: false };
}
