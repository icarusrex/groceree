import React from "react";
import { useStore } from "../store.tsx";
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
      <div className="panel">
      <label className="field">
        <span>Country (which stores you'll see)</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={s.settings.country}
            onChange={(e) => set({ country: e.target.value })}>
            <option value="PT">🇵🇹 Portugal</option>
            <option value="CZ">🇨🇿 Czech Republic</option>
          </select>
          <button className="btn small" onClick={() => {
            const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })();
            set({ country: /Prague|Czech/i.test(tz) ? "CZ" : "PT" });
          }}>📍 Detect</button>
        </div>
      </label>
      <label className="field">
        <span>Number of people</span>
        <input type="number" min={1} max={12} step={1} value={s.settings.household_size}
          onChange={(e) => set({ household_size: Math.round(Number(e.target.value)) || 1 })} />
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
      <label className="field">
        <span>Notion page for shopping lists</span>
        <input type="text" value={s.settings.notion_parent_id ?? ""}
          placeholder="paste the Notion page URL"
          onChange={(e) => set({ notion_parent_id: e.target.value })} />
        <small className="muted">
          Each export becomes a new sub-page here, so this must be a <b>page</b>,
          not a database. Paste the full URL — the id is picked out of it. The page
          must be shared with the Groceree integration in Notion (page → ••• →
          Connections).
        </small>
      </label>
      </div>
    </div>
  );
}
