// Money: recipe → € from the price book, and a week plan that fits the budget.
//
// Costs use the shopping list's own normalisation (toBuyItem), so a recipe line
// becomes grams or pieces of a canonical ingredient, times its unit price.
// Cupboard staples (oil, salt, spices, herbs) are left out: pennies per meal,
// and bought every few weeks rather than per recipe. Receipts still count them.
//
// The budget applies to the WEEK, not each meal: a pricey dinner is fine when
// cheaper meals balance it. And to the MONTH: a cheap week leaves more for the
// next (the weekly target is what's left of the month over the weeks left).

import { toBuyItem, gramsPerItemOf } from "./normalise.ts";
import type { Recipe, PlanItem, GenerateInput } from "./types.ts";
import { generatePlan, scoreAll } from "./engine.ts";

export interface UnitPrice { per_kg: number | null; per_item: number | null; source?: string }
export type PriceBook = Record<string, UnitPrice>;
export type Deals = Record<string, number>; // flyer deals: name(lower) → discount 0..1

// Share of the food budget that lunches + dinners take; the rest is breakfasts,
// snacks and extras the plan doesn't cover. An assumption, shown in the UI.
export const PLANNED_MEALS_SHARE = 0.75;

// Flyer deals are keyed by the flyer's own names; fold them onto canonical names.
export function dealsByItem(deals: Deals = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, d] of Object.entries(deals)) {
    const c = toBuyItem(name, null, "", "pantry").name;
    if (c && d > (out[c] ?? 0)) out[c] = d;
  }
  return out;
}

// € for a quantity of one canonical ingredient, or null when it can't be priced.
export function lineCost(name: string, quantity: number | null, unit: string,
                         prices: PriceBook, deals: Record<string, number> = {}): number | null {
  const p = prices[name];
  if (!p || quantity == null) return null;
  const off = 1 - Math.min(0.9, deals[name] ?? 0);
  if (unit === "g" || unit === "kg") {
    const kg = unit === "kg" ? quantity : quantity / 1000;
    if (p.per_kg != null) return kg * p.per_kg * off;
    const gpi = gramsPerItemOf(name);
    return p.per_item != null && gpi ? (kg * 1000 / gpi) * p.per_item * off : null;
  }
  // counted (pieces, cans): by weight when we know a piece's weight (onions are
  // sold by the kg), else a real per-piece price (eggs)
  const gpi = gramsPerItemOf(name);
  if (p.per_kg != null && gpi) return quantity * gpi / 1000 * p.per_kg * off;
  return p.per_item != null ? quantity * p.per_item * off : null;
}

export interface RecipeCost { total: number; perServing: number; coverage: number }

// Cost of cooking a recipe for `servings` (defaults to as written). coverage =
// share of the priceable (non-staple) lines that had a price — a low-coverage
// estimate is a guess and the UI says so.
export function recipeCost(r: Recipe, prices: PriceBook, deals: Record<string, number> = {},
                           servings = r.servings || 1): RecipeCost {
  const scale = servings / (r.servings || servings);
  let total = 0, lines = 0, priced = 0, proteinMissing = false, proteinLines = 0;
  let sidesCost = 0, sidesPriced = 0, sidesMissing = 0; // non-protein lines
  for (const ing of r.ingredients) {
    const b = toBuyItem(ing.name, ing.quantity != null ? ing.quantity * scale : null, ing.unit ?? "", ing.category);
    if (!b.name || b.staple) continue;
    lines++;
    if (/^(meat|fish|seafood)$/.test(b.category)) proteinLines++;
    const isProtein = /^(meat|fish|seafood)$/.test(b.category);
    const c = lineCost(b.name, b.quantity, b.unit, prices, deals);
    if (c != null) { total += c; priced++; if (!isProtein) { sidesCost += c; sidesPriced++; } }
    else if (isProtein) proteinMissing = true;
    else sidesMissing++;
  }
  // The protein is most of a meal's cost; extrapolating from the onions and
  // garlic around an unpriced one would call trout nearly free. No estimate.
  // Same when a meat/fish dish lists no meat or fish at all — some imported
  // recipes lost their main ingredient lines.
  const noProtein = !!r.primary_protein && r.primary_protein !== "none" && proteinLines === 0;
  if (proteinMissing || noProtein) return { total: 0, perServing: 0, coverage: 0 };
  // Unpriced side lines (herbs, a cheese) count at the average priced side line —
  // not the average of every line, which the protein would inflate. coverage
  // flags how much of the figure is that kind of fill-in.
  const coverage = lines ? priced / lines : 1;
  const est = priced ? total + (sidesPriced ? sidesMissing * sidesCost / sidesPriced : 0) : 0;
  return { total: est, perServing: est / Math.max(1, servings), coverage };
}

export interface PlanCost { total: number; coverage: number; byItem: Map<PlanItem, RecipeCost> }

// Cost of the cooked meals in a plan (leftovers are free — cooked the day before,
// already sized for them).
export function planCost(plan: PlanItem[], recipes: Recipe[], prices: PriceBook, deals: Deals = {}): PlanCost {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const d = dealsByItem(deals);
  const byItem = new Map<PlanItem, RecipeCost>();
  let total = 0, covSum = 0, n = 0;
  for (const item of plan) {
    const r = item.recipe_id ? byId.get(item.recipe_id) : null;
    if (!r || item.is_leftover) continue;
    const c = recipeCost(r, prices, d, item.servings || r.servings);
    byItem.set(item, c);
    total += c.total; covSum += c.coverage; n++;
  }
  return { total, coverage: n ? covSum / n : 0, byItem };
}

// ---- budget ----------------------------------------------------------------
export interface WeekBudget {
  weekly: number;        // this week's allowance (month carry-over applied)
  planTarget: number;    // what the planned meals should fit in
  monthLeft: number;
  weeksLeft: number;
}

// monthSpent: grocery spend from this month's receipts. Weeks left counts this
// one, so the last days of a month still get a sensible allowance.
export function weekBudget(monthly: number, monthSpent: number, planDays: number, today = new Date()): WeekBudget {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - today.getDate() + 1;
  const weeksLeft = Math.max(1, daysLeft / 7);
  const monthLeft = Math.max(0, monthly - monthSpent);
  // no receipts yet → the plain average week; otherwise spread what's left
  const weekly = monthSpent > 0 ? monthLeft / weeksLeft : monthly * 12 / 52;
  return { weekly, planTarget: weekly * Math.min(7, planDays) / 7 * PLANNED_MEALS_SHARE, monthLeft, weeksLeft };
}

// Build several candidate weeks the normal way (preferences, season, ease,
// variety) and keep the best-liked one that fits the target — so expensive and
// cheap meals mix freely as long as the week adds up. None fits → the cheapest.
export function generateWithinBudget(input: GenerateInput, prices: PriceBook, target: number | null,
                                     tries = 24): { plan: PlanItem[]; cost: PlanCost } {
  const base = input.seed ?? Math.floor(Math.random() * 1e9);
  const scoreOf = new Map<string, number>();
  let best: { plan: PlanItem[]; cost: PlanCost; pref: number } | null = null;
  let cheapest: typeof best = null;
  for (let t = 0; t < (target ? tries : 1); t++) {
    const seed = base + t * 7919;
    const plan = generatePlan({ ...input, seed });
    if (!scoreOf.size) for (const s of scoreAll({ ...input, seed: base })) scoreOf.set(s.recipe.id, s.base);
    const cost = planCost(plan, input.recipes, prices, input.deals);
    const pref = plan.filter((p) => !p.is_leftover).reduce((a, p) => a + (scoreOf.get(p.recipe_id!) ?? 0), 0);
    const cand = { plan, cost, pref };
    if (!cheapest || cost.total < cheapest.cost.total) cheapest = cand;
    // Under half the ingredients priced (price book still filling) → the total
    // is mostly extrapolation; don't let it veto a plan.
    const fits = target == null || cost.coverage < 0.5 || cost.total <= target;
    if (fits && (!best || pref > best.pref)) best = cand;
  }
  const pick = best ?? cheapest!;
  return { plan: pick.plan, cost: pick.cost };
}
