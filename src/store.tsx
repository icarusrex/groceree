import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./lib/api.ts";
import { sizePlanForLeftovers } from "./engine/engine.ts";
import { toBuyItem } from "./engine/normalise.ts";
import { generateWithinBudget, weekBudget, type PriceBook } from "./engine/cost.ts";
import type { Recipe, Settings, PlanItem, RecipeState } from "./engine/types.ts";

interface Store {
  recipes: Recipe[];
  settings: Settings;
  states: Record<string, RecipeState>;
  pantry: any[];
  plan: PlanItem[];
  deals: Record<string, number>;
  loading: boolean;
  generate: (days?: number) => void;
  setSettings: (s: Settings) => void;
  signal: (id: string, sig: string) => void;
  addPantry: (t: string) => void;
  delPantry: (id: number) => void;
  refreshPantry: () => Promise<void>;
  setDeals: (d: Record<string, number>) => void;
  savePlan: () => Promise<void>;
  assignSlot: (day: number, slot: string, recipeId: string) => void;
  clearSlot: (day: number, slot: string) => void;
  applyPlanChanges: (changes: { day_of_week: number; slot: string; recipe_id: string }[]) => void;
  replacePlanRecipe: (oldId: string, newId: string) => void;
  refreshRecipes: () => Promise<void>;
  prices: PriceBook;
  pricing: { done: number; total: number } | null; // background price-book fill
  spend: { week: { spent: number; receipts: number }; month: { spent: number; receipts: number } } | null;
  refreshSpend: () => Promise<void>;
}

const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);

// Guess the country once from the browser timezone (Europe/Prague → CZ), so a
// Czech user lands on Czech stores without hunting for the setting. They can
// still change it in Settings, and once saved it sticks.
const guessCountry = (): "PT" | "CZ" => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return /Prague|Czech/i.test(tz) ? "CZ" : "PT";
  } catch { return "PT"; }
};
const DEFAULTS: Settings = {
  household_size: 2, diet: [], exclude_cuisines: [],
  max_active_minutes: null, leftover_strategy: "auto",
  plan_days: 4, selected_stores: [], country: guessCountry(),
};

function mondayOf(d = new Date()) {
  const x = new Date(d); const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day); return x.toISOString().slice(0, 10);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULTS);
  const [states, setStates] = useState<Record<string, RecipeState>>({});
  const [pantry, setPantry] = useState<any[]>([]);
  const [plan, setPlan] = useState<PlanItem[]>(
    () => JSON.parse(localStorage.getItem("plan") || "[]"));
  const [deals, setDeals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState<PriceBook>({});
  const [pricing, setPricing] = useState<{ done: number; total: number } | null>(null);
  const [spend, setSpend] = useState<Store["spend"]>(null);
  const refreshSpend = () => api.spend(mondayOf()).then((r) => { if (!r?.error) setSpend(r); }).catch(() => {});

  useEffect(() => {
    Promise.all([api.recipes(), api.settings(), api.states(), api.pantry()])
      .then(([r, s, st, p]) => {
        setRecipes(r); setSettingsState(s || DEFAULTS); setStates(st || {});
        setPantry(p || []);
      })
      .finally(() => setLoading(false));
    refreshSpend();
  }, []);

  // Price book: load it, then quietly fill whatever the recipes need that it
  // lacks — a few ingredients per request (Auchan search + Gemini), in the
  // background while the app is open. One-off ~150 ingredients, then monthly.
  useEffect(() => {
    if (!recipes.length) return;
    let live = true;
    (async () => {
      const book = await api.priceBook().catch(() => null);
      if (!live || !book || book.error) return;
      setPrices(book.prices || {});
      const known = new Set<string>([...Object.keys(book.prices || {}), ...(book.fresh || [])]);
      const need = new Set<string>();
      for (const r of recipes) for (const i of r.ingredients) {
        const b = toBuyItem(i.name, i.quantity ?? null, i.unit ?? "", i.category);
        if (b.name && !b.staple && b.quantity != null && !known.has(b.name)) need.add(b.name);
      }
      const todo = [...need];
      if (!todo.length) return;
      setPricing({ done: 0, total: todo.length });
      let fails = 0;
      for (let i = 0; i < todo.length && live && fails < 3; i += 8) {
        const r = await api.priceFill(todo.slice(i, i + 8)).catch(() => null);
        if (!r || r.error) { fails++; continue; }
        fails = 0;
        setPrices((prev) => {
          const next = { ...prev };
          for (const p of r.priced || []) if ((p.per_kg ?? p.per_item) != null && next[p.item]?.source !== "receipt")
            next[p.item] = { per_kg: p.per_kg, per_item: p.per_item, source: "shelf" };
          return next;
        });
        setPricing({ done: Math.min(todo.length, i + 8), total: todo.length });
      }
      if (live) setPricing(null);
    })();
    return () => { live = false; };
  }, [recipes.length]);

  const persist = (p: PlanItem[]) => { setPlan(p); localStorage.setItem("plan", JSON.stringify(p)); };

  const store: Store = {
    recipes, settings, states, pantry, plan, deals, loading, prices, pricing, spend, refreshSpend,
    // With a budget set, pick the best-liked of many candidate weeks that fits
    // the week's target (month carry-over included); otherwise a normal plan.
    generate: (days?: number) => {
      const pantryNames = pantry.map((x) => x.name || x.raw_text);
      const planDays = days ?? settings.plan_days ?? 4;
      const target = settings.monthly_food_budget
        ? weekBudget(settings.monthly_food_budget, spend?.month.spent ?? 0, planDays).planTarget : null;
      persist(generateWithinBudget({ recipes, settings, states, pantry: pantryNames, deals,
        days, seed: Math.floor(Math.random() * 1e9) }, prices, target).plan);
    },
    setSettings: (s) => { setSettingsState(s); api.saveSettings(s); },
    signal: (id, sig) => {
      setStates((prev) => {
        const cur = { ...(prev[id] || {}) };
        if (sig === "favorite") cur.is_favorite = true;
        if (sig === "unfavorite") cur.is_favorite = false;
        if (sig === "hide") cur.is_hidden = true;
        if (sig === "unhide") cur.is_hidden = false;
        return { ...prev, [id]: cur };
      });
      api.signal(id, sig);
    },
    addPantry: (t) => { api.addPantry(t).then(() => api.pantry().then(setPantry)); },
    delPantry: (id) => { api.delPantry(id).then(() => api.pantry().then(setPantry)); },
    refreshPantry: () => api.pantry().then(setPantry),
    setDeals,
    savePlan: () => {
      // Re-derive leftover sizing from the (possibly edited) plan before saving,
      // so dinners reused as lunch are cooked/shopped for every meal they feed.
      const sized = sizePlanForLeftovers(plan, settings.household_size);
      persist(sized);
      const items = sized.map((p) => ({ day_of_week: p.day_of_week, slot: p.slot,
        recipe_id: p.recipe_id, is_leftover: p.is_leftover, servings: p.servings }));
      return api.savePlan({ week_start: mondayOf(), status: "saved", items });
    },
    assignSlot: (day, slot, recipeId) => {
      const next = plan.filter((p) => !(p.day_of_week === day && p.slot === slot));
      next.push({ day_of_week: day, slot: slot as any, recipe_id: recipeId,
        is_leftover: false, leftover_of: null, servings: settings.household_size });
      persist(next);
    },
    clearSlot: (day, slot) => {
      persist(plan.filter((p) => !(p.day_of_week === day && p.slot === slot)));
    },
    applyPlanChanges: (changes) => {
      const known = new Set(recipes.map((r) => r.id));
      let next = [...plan];
      for (const c of changes) {
        if (!known.has(c.recipe_id)) continue;
        next = next.filter((p) => !(p.day_of_week === c.day_of_week && p.slot === c.slot));
        next.push({ day_of_week: c.day_of_week, slot: c.slot as any, recipe_id: c.recipe_id,
          is_leftover: false, leftover_of: null, servings: settings.household_size });
      }
      next.sort((a, b) => a.day_of_week - b.day_of_week || (a.slot === "lunch" ? -1 : 1));
      persist(next);
    },
    // After a remix is saved as a new recipe, point every plan slot that used the
    // original at the new recipe — so the meal plan AND the derived shopping list
    // reflect the swap (e.g. the fennel-free version) instead of the original.
    replacePlanRecipe: (oldId, newId) => {
      if (!oldId || !newId || oldId === newId) return;
      persist(plan.map((p) => (p.recipe_id === oldId ? { ...p, recipe_id: newId } : p)));
    },
    refreshRecipes: () => api.recipes().then(setRecipes),
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
