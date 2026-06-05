import React, { useEffect, useState } from "react";
import { api } from "../lib/api.ts";

// Staple basket: log REGULAR shelf prices for staples you actually buy, per store.
// Because it's the same item at each store, the resulting price-level index is a
// true apples-to-apples comparison — the honest answer to "which store is dearer",
// unlike flyer averages (which only reflect what each store chose to promote).
type Data = {
  stores: string[];
  items: string[];
  prices: Record<string, Record<string, number>>;
  index: { store: string; index: number; n: number }[];
  comparable_items: number;
  updated: string | null;
};

const eur = (n: number) => "€" + n.toFixed(2);

export default function BasketTracker() {
  const [data, setData] = useState<Data | null>(null);
  const [newItem, setNewItem] = useState("");
  // local edit buffer so typing doesn't fight the round-trip
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = () => api.basket().then(setData).catch(() => {});
  useEffect(() => { load(); }, []);

  if (!data) return <p className="muted">Loading basket…</p>;

  const cellKey = (item: string, store: string) => `${item}|||${store}`;
  const valueOf = (item: string, store: string) => {
    const k = cellKey(item, store);
    if (k in draft) return draft[k];
    const p = data.prices[item]?.[store];
    return p != null ? String(p) : "";
  };
  const commit = async (item: string, store: string, raw: string) => {
    const trimmed = raw.trim();
    const price = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (price != null && !isFinite(price)) return;
    await api.basketSet(item, store, price);
    setDraft((d) => { const n = { ...d }; delete n[cellKey(item, store)]; return n; });
    load();
  };
  const addItem = async () => {
    const it = newItem.trim();
    if (!it) return;
    await api.basketItem("addItem", it);
    setNewItem(""); load();
  };
  const removeItem = async (item: string) => {
    await api.basketItem("removeItem", item); load();
  };

  const cheapest = data.index[0]?.store;

  return (
    <div className="basket">
      <h3 style={{ marginTop: 0 }}>Staple basket — regular prices</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        Enter the normal (non-sale) shelf price of staples you actually buy, at each store. Same
        item compared like-for-like — this is the honest price-level read, immune to flyer skew.
      </p>

      {data.index.length > 1 && (
        <div className="bk-index">
          <div className="bk-index-head">Price level
            <span className="muted small"> · from {data.comparable_items} item{data.comparable_items === 1 ? "" : "s"} priced at 2+ stores</span>
          </div>
          <div className="bk-ix-row">
            {data.index.map((p, i) => (
              <span className="bk-ix" key={p.store}>
                <b>{p.store}</b> {i === 0 ? "cheapest" : `+${Math.round((p.index - 1) * 100)}%`}
                <span className="muted small"> ({p.n})</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {data.index.length <= 1 && (
        <p className="muted small">Fill in at least one staple at 2+ stores to see the price-level comparison.</p>
      )}

      <div className="bk-scroll">
        <table className="bk-table">
          <thead>
            <tr>
              <th>Staple</th>
              {data.stores.map((s) => <th key={s} className={s === cheapest ? "bk-cheap" : ""}>{s}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item}>
                <td className="bk-item">{item}</td>
                {data.stores.map((store) => (
                  <td key={store}>
                    <input className="bk-input" inputMode="decimal" placeholder="—"
                      value={valueOf(item, store)}
                      onChange={(e) => setDraft((d) => ({ ...d, [cellKey(item, store)]: e.target.value }))}
                      onBlur={(e) => commit(item, store, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                  </td>
                ))}
                <td><button className="icon" title="remove staple" onClick={() => removeItem(item)}>🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="add-row" style={{ maxWidth: 360 }}>
        <input placeholder="Add a staple, e.g. Plant milk (1L)" value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addItem(); }} />
        <button className="btn" onClick={addItem}>Add</button>
      </div>
    </div>
  );
}
