import React, { useMemo, useState } from "react";
import { useStore } from "../store.tsx";
import { buildShoppingList } from "../engine/engine.ts";

export default function Shop() {
  const s = useStore();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const list = useMemo(
    () => buildShoppingList(s.plan, s.recipes, s.settings.household_size),
    [s.plan, s.recipes, s.settings.household_size]);

  if (!s.plan.length) return <div><h1>Shopping List</h1><p className="muted">Generate a meal plan first.</p></div>;

  const groups: Record<string, typeof list> = {};
  for (const i of list) (groups[i.category] ||= []).push(i);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <div>
      <h1>Shopping List</h1>
      <p className="muted">{done}/{list.length} picked · built from non-leftover meals, scaled to {s.settings.household_size} people</p>
      {Object.entries(groups).map(([cat, items]) => (
        <div className="shop-group" key={cat}>
          <h3>{cat}</h3>
          {items.map((i) => {
            const key = i.name + i.unit;
            const q = i.quantity != null ? `${Math.round(i.quantity * 10) / 10}${i.unit ? " " + i.unit : ""}` : "";
            return (
              <label className="shop-row" key={key}>
                <input type="checkbox" checked={!!checked[key]}
                  onChange={() => setChecked({ ...checked, [key]: !checked[key] })} />
                <span className={checked[key] ? "struck" : ""}>{i.name} {q && <em>· {q}</em>}</span>
                <span className="meta">{i.recipes.length} recipe{i.recipes.length > 1 ? "s" : ""}</span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}
