import React, { useMemo, useState } from "react";
import { planDates } from "../engine/planDates.ts";
import { useStore } from "../store.tsx";
import { buildShoppingList, tidyAmount } from "../engine/engine.ts";
import { dealsByItem, lineCost } from "../engine/cost.ts";

// Where "→ Obsidian" writes the list: the vault Syncthing mirrors to the phone.
const OBSIDIAN_VAULT = "vault";
const OBSIDIAN_NOTE = "04-personal/Meal Plan/Shopping list";

export default function Shop() {
  const s = useStore();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const list = useMemo(
    () => buildShoppingList(s.plan, s.recipes, s.settings.household_size,
      s.pantry.map((p: any) => p.name || p.raw_text)),
    [s.plan, s.recipes, s.settings.household_size, s.pantry]);

  if (!s.plan.length) return <div><h1>Shopping List</h1><p className="muted">Generate a meal plan first.</p></div>;

  // Estimated € per line from the price book (flyer deals applied); staples aren't priced.
  const dealMap = dealsByItem(s.deals);
  const buy = list.map((i) => ({ ...i, amt: tidyAmount(i), est: lineCost(i.name, i.quantity, i.unit, s.prices, dealMap) }))
    .filter((i) => !i.amt.staple);
  const estLeft = buy.filter((i) => !checked[i.name + i.unit]);
  const estTotal = estLeft.reduce((a, i) => a + (i.est ?? 0), 0);
  const estMissing = estLeft.filter((i) => i.est == null).length;
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

  // Markdown checklist, one "## category" per group — ticks off in Obsidian (and
  // reads fine pasted into Keep / a chat).
  const markdown = () => {
    const lines = [`# Shopping list`, ``, `_${s.planSync.start_date} to ${planDates(s.planSync.start_date,s.planSync.plan_days).at(-1)!.date} · ${s.settings.household_size} people_`];
    for (const g of exportGroups()) {
      lines.push("", `## ${g.category}`);
      for (const i of g.items) lines.push(`- [ ] ${i.name}${i.amount ? ` — ${i.amount}` : ""}`);
    }
    return lines.join("\n") + "\n";
  };

  // Overwrites the note in the vault via Obsidian's own URI (works from the Mac
  // or the phone app); Syncthing carries it to the other device.
  const sendToObsidian = () => {
    const q = new URLSearchParams({ vault: OBSIDIAN_VAULT, file: OBSIDIAN_NOTE, content: markdown(), overwrite: "true" });
    window.location.href = `obsidian://new?${q.toString().replace(/\+/g, "%20")}`;
    setExportMsg(`Sent ${remaining} items to Obsidian → ${OBSIDIAN_NOTE}.md`);
  };

  // Phone: native share sheet (Keep, WhatsApp, …). Desktop: clipboard.
  const share = async () => {
    const text = markdown();
    try {
      if (navigator.share) { await navigator.share({ title: "Shopping list", text }); return; }
      await navigator.clipboard.writeText(text);
      setExportMsg(`Copied ${remaining} items to the clipboard.`);
    } catch (e: any) {
      if (e?.name !== "AbortError") setExportMsg(`Share failed: ${String(e?.message || e)}`);
    }
  };

  return (
    <div>
      <h1>Shopping List</h1>
      <p className="muted small">For {s.planSync.start_date} to {planDates(s.planSync.start_date,s.planSync.plan_days).at(-1)!.date}</p>
      <p className="muted">{done}/{buy.length} picked · scaled to {s.settings.household_size} people · leftovers excluded
        {estTotal > 0 && <> · <b>≈€{Math.round(estTotal)}</b> to go{estMissing ? ` (${estMissing} item${estMissing > 1 ? "s" : ""} not priced yet)` : ""}</>}</p>
      <div className="shop-actions">
        <button className="btn dark" disabled={!remaining} onClick={sendToObsidian}
          title={`Write the unticked items to ${OBSIDIAN_NOTE}.md in Obsidian (syncs to the phone)`}>
          {`→ Obsidian${remaining ? ` (${remaining})` : ""}`}
        </button>
        <button className="btn ghost" disabled={!remaining} onClick={share}
          title="Share sheet on the phone (Keep, messages…); copies to the clipboard on desktop">
          {"share" in navigator ? "Share…" : "Copy"}
        </button>
      </div>
      {exportMsg && <div className="banner">{exportMsg}</div>}
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
                  {i.name}{i.amt.text && <em> · {i.amt.text}</em>}
                  {i.est != null && <span className="muted small cost-chip"> ≈€{i.est.toFixed(2)}</span>}</span>
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
