import React from "react";
import { useStore } from "../store.tsx";
import PriceTrends from "../components/PriceTrends.tsx";
import type { Diet } from "../engine/types.ts";

const DIETS: Diet[] = ["gluten_free", "vegetarian", "pescatarian", "dairy_free"];

export default function Settings() {
  const s = useStore();
  const set = (patch: any) => s.setSettings({ ...s.settings, ...patch });
  const toggleDiet = (d: Diet) => {
    const has = s.settings.diet.includes(d);
    set({ diet: has ? s.settings.diet.filter((x) => x !== d) : [...s.settings.diet, d] });
  };
  return (
    <div className="settings">
      <h1>Settings</h1>
      <label className="field">
        <span>Number of people</span>
        <input type="number" min={1} max={12} value={s.settings.household_size}
          onChange={(e) => set({ household_size: Number(e.target.value) })} />
      </label>
      <div className="field">
        <span>Diet limitations</span>
        <div className="chips">
          {DIETS.map((d) => (
            <button key={d} className={s.settings.diet.includes(d) ? "chip on" : "chip"}
              onClick={() => toggleDiet(d)}>{d.replace("_", " ")}</button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Max active cooking time (min, weeknights)</span>
        <input type="number" min={10} max={120} value={s.settings.max_active_minutes ?? ""}
          placeholder="no limit"
          onChange={(e) => set({ max_active_minutes: e.target.value ? Number(e.target.value) : null })} />
      </label>
      <label className="field">
        <span>Leftovers</span>
        <select value={s.settings.leftover_strategy}
          onChange={(e) => set({ leftover_strategy: e.target.value })}>
          <option value="auto">Auto — reuse big dinners as next-day lunch</option>
          <option value="off">Off — cook every meal</option>
        </select>
      </label>
      <div className="field">
        <span>Grocery price trends</span>
        <p className="muted small">Average price per category over time, from the flyers you upload. One line per category; filter by store.</p>
        <PriceTrends />
      </div>
    </div>
  );
}
