import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./lib/api.ts";
import { generatePlan } from "./engine/engine.ts";
import type { Recipe, Settings, PlanItem, RecipeState } from "./engine/types.ts";

interface Store {
  recipes: Recipe[];
  settings: Settings;
  states: Record<string, RecipeState>;
  pantry: any[];
  plan: PlanItem[];
  deals: Record<string, number>;
  loading: boolean;
  generate: () => void;
  setSettings: (s: Settings) => void;
  signal: (id: string, sig: string) => void;
  addPantry: (t: string) => void;
  delPantry: (id: number) => void;
  setDeals: (d: Record<string, number>) => void;
  savePlan: () => void;
}

const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);

const DEFAULTS: Settings = {
  household_size: 2, diet: [], exclude_cuisines: [],
  max_active_minutes: null, leftover_strategy: "auto",
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

  useEffect(() => {
    Promise.all([api.recipes(), api.settings(), api.states(), api.pantry()])
      .then(([r, s, st, p]) => {
        setRecipes(r); setSettingsState(s || DEFAULTS); setStates(st || {});
        setPantry(p || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = (p: PlanItem[]) => { setPlan(p); localStorage.setItem("plan", JSON.stringify(p)); };

  const store: Store = {
    recipes, settings, states, pantry, plan, deals, loading,
    generate: () => {
      const pantryNames = pantry.map((x) => x.name || x.raw_text);
      persist(generatePlan({ recipes, settings, states, pantry: pantryNames, deals,
        seed: Math.floor(Math.random() * 1e9) }));
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
    setDeals,
    savePlan: () => {
      const items = plan.map((p) => ({ day_of_week: p.day_of_week, slot: p.slot,
        recipe_id: p.recipe_id, is_leftover: p.is_leftover, servings: p.servings }));
      api.savePlan({ week_start: mondayOf(), status: "saved", items });
    },
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
