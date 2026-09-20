import React, { useMemo, useState } from "react";
import { useStore } from "../store.tsx";
import { buildShoppingList, tidyAmount } from "../engine/engine.ts";
import { api } from "../lib/api.ts";

export default function Shop() {
  const s = useStore();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ text: string; url?: string } | null>(null);
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

  // Only what is still unticked goes to the phone — anything already picked
  // (or sent to the pantry with →🥫, which ticks it too) is not shopping.
  const exportGroups = () => {
    const out: { category: string; items: { name: string; amount?: string }[] }[] = [];
    for (const [cat, items] of Object.entries(groups)) {
      const left = items.filter((i) => !checked[i.name + i.unit])
        .map((i) => ({ name: i.name, amount: i.amt.text || undefined }));
      if (left.length) out.push({ category: cat, items: left });
    }
    const left = staples.filter((i) => !checked["p" + i.name]).map((i) => ({ name: i.name }));
    if (left.length) out.push({ category: "Pantry & seasonings", items: left });
    return out;
  };
  const remaining = exportGroups().reduce((n, g) => n + g.items.length, 0);

  const sendToNotion = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const r = await api.exportNotion({ groups: exportGroups() });
      setExportMsg(r?.error ? { text: r.error } : { text: `Sent ${r.items} items to Notion.`, url: r.url });
    } catch (e: any) {
      setExportMsg({ text: `Export failed: ${String(e?.message || e)}` });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <h1>Shopping List</h1>
      <p className="muted">{done}/{buy.length} picked · scaled to {s.settings.household_size} people · leftovers excluded</p>
      <div className="shop-actions">
        <button className="btn dark" disabled={exporting || !remaining} onClick={sendToNotion}
          title="Create a Notion page with the unticked items, grouped by category">
          {exporting ? "Sending…" : `→ Notion${remaining ? ` (${remaining})` : ""}`}
        </button>
      </div>
      {exportMsg && (
        <div className="banner">
          {exportMsg.text}
          {exportMsg.url && <> <a href={exportMsg.url} target="_blank" rel="noreferrer">Open it</a></>}
        </div>
      )}
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
                <button className="icon to-pantry" title="move to pantry"
                  onClick={(e) => { e.preventDefault();
                    s.addPantry(`${i.amt.text ? i.amt.text + " " : ""}${i.name}`);
                    setChecked({ ...checked, [key]: true }); }}>→🥫</button>
              </label>
            );
          })}
        </div>
      ))}
      {staples.length > 0 && (
        <div className="shop-group staples">
          <h3>Pantry &amp; seasonings</h3>
          {staples.map((i) => {
            const key = "p" + i.name;
            return (
              <label className="shop-row" key={key}>
                <input type="checkbox" checked={!!checked[key]}
                  onChange={() => setChecked({ ...checked, [key]: !checked[key] })} />
                <span className={checked[key] ? "struck" : ""}>{i.name}</span>
                <button className="icon to-pantry" title="keep in pantry"
                  onClick={(e) => { e.preventDefault();
                    s.addPantry(i.name);
                    setChecked({ ...checked, [key]: true }); }}>→🥫</button>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
