import React, { useMemo, useState } from "react";
import { useStore } from "../store.tsx";
import { buildShoppingList, tidyAmount } from "../engine/engine.ts";

export default function Shop() {
  const s = useStore();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const list = useMemo(
    () => buildShoppingList(s.plan, s.recipes, s.settings.household_size,
      s.pantry.map((p: any) => p.name || p.raw_text)),
    [s.plan, s.recipes, s.settings.household_size, s.pantry]);

  if (!s.plan.length) return <div><h1>Shopping List</h1><p className="muted">Generate a meal plan first.</p></div>;

  const buy = list.map((i) => ({ ...i, amt: tidyAmount(i) })).filter((i) => !i.amt.staple);
  const staples = list.filter((i) => tidyAmount(i).staple);

  const groups: Record<string, typeof buy> = {};
  for (const i of buy) (groups[i.category] ||= []).push(i);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <div>
      <h1>Shopping List</h1>
      <p className="muted">{done}/{buy.length} picked · scaled to {s.settings.household_size} people · leftovers excluded</p>
      {Object.entries(groups).map(([cat, items]) => (
        <div className="shop-group" key={cat}>
          <h3>{cat}</h3>
          {items.map((i) => {
            const key = i.name + i.unit;
            return (
              <label className="shop-row" key={key}>
                <input type="checkbox" checked={!!checked[key]}
                  onChange={() => setChecked({ ...checked, [key]: !checked[key] })} />
                <span className={checked[key] ? "struck" : ""}>
                  {i.name}{i.amt.text && <em> · {i.amt.text}</em>}</span>
                <span className="meta">{i.recipes.length} recipe{i.recipes.length > 1 ? "s" : ""}</span>
              </label>
            );
          })}
        </div>
      ))}
      {staples.length > 0 && (
        <div className="shop-group">
          <h3>Pantry &amp; seasonings — check you have these</h3>
          <p className="muted small">Small amounts you usually buy as a jar/pack and likely have.</p>
          {staples.map((i) => {
            const key = "p" + i.name;
            return (
              <label className="shop-row" key={key}>
                <input type="checkbox" checked={!!checked[key]}
                  onChange={() => setChecked({ ...checked, [key]: !checked[key] })} />
                <span className={checked[key] ? "struck" : ""}>{i.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
