import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.ts";

// Store colours (extensible — Pingo Doce / Intermarché / Continente can be added).
const STORE_COLORS: Record<string, string> = {
  ALDI: "#00457c", Lidl: "#e3000f", "Pingo Doce": "#00a651",
  Intermarché: "#e2001a", Continente: "#e30613",
};
const colorFor = (s: string) =>
  STORE_COLORS[s] || ["#0f6e56", "#8b5cf6", "#b8860b", "#185fa5"][Math.abs(hash(s)) % 4];
function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

const CAT_ORDER = ["produce", "meat", "fish", "dairy", "pantry"];
const eur = (n: number) => "€" + n.toFixed(2);

type Pt = { date: string; store: string; category: string; avg_price: number; n: number };
type Item = { store: string; name: string; price: number; date: string; cat: string };

export default function PriceTrends() {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"compare" | "trend">("compare");

  useEffect(() => { api.prices().then(setData).catch(() => setData({ count: 0, points: [], items: [] })); }, []);

  // latest flyer date per store — compare current flyers, never mix dates.
  const latest = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of (data?.points || []) as Pt[]) if (!m[p.store] || p.date > m[p.store]) m[p.store] = p.date;
    return m;
  }, [data]);

  // category -> store -> avg price, using each store's most recent flyer.
  const compare = useMemo(() => {
    if (!data?.points?.length) return null;
    const cur = (data.points as Pt[]).filter((p) => p.date === latest[p.store]);
    const cats = [...new Set(cur.map((p) => p.category))]
      .sort((a, b) => (CAT_ORDER.indexOf(a) + 1 || 99) - (CAT_ORDER.indexOf(b) + 1 || 99));
    const byCat: Record<string, Record<string, number>> = {};
    for (const p of cur) (byCat[p.category] ||= {})[p.store] = p.avg_price;
    // who wins each category (lowest avg)
    let wins: Record<string, number> = {};
    for (const c of cats) {
      const entries = Object.entries(byCat[c]);
      if (entries.length < 2) continue;
      const win = entries.sort((a, b) => a[1] - b[1])[0][0];
      wins[win] = (wins[win] || 0) + 1;
    }
    return { cats, byCat, wins };
  }, [data, latest]);

  // identical items carried by 2+ stores — the precise "who's cheaper" signal.
  const matched = useMemo(() => {
    if (!data?.items?.length) return [];
    const byName: Record<string, Item[]> = {};
    for (const it of data.items as Item[]) {
      // keep only the latest price per store for that item
      const key = it.name.toLowerCase().trim();
      (byName[key] ||= []).push(it);
    }
    const rows: { name: string; prices: Record<string, number> }[] = [];
    for (const [, list] of Object.entries(byName)) {
      const perStore: Record<string, Item> = {};
      for (const it of list) if (!perStore[it.store] || it.date > perStore[it.store].date) perStore[it.store] = it;
      if (Object.keys(perStore).length < 2) continue;
      rows.push({
        name: list[0].name,
        prices: Object.fromEntries(Object.entries(perStore).map(([s, it]) => [s, it.price])),
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  if (!data) return <p className="muted">Loading price data…</p>;
  if (!data.count) {
    return (
      <div className="trend-empty">
        <p className="muted">
          No flyer prices yet. Upload flyers (Meal Plan → “From flyer”) and this builds a
          store-vs-store price comparison plus trends over time.
        </p>
      </div>
    );
  }

  const stores: string[] = data.stores;
  const winner = compare && Object.entries(compare.wins).sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button className={tab === "compare" ? "chip on" : "chip"} onClick={() => setTab("compare")}>
          Who’s cheaper</button>
        <button className={tab === "trend" ? "chip on" : "chip"} onClick={() => setTab("trend")}>
          Trend over time</button>
      </div>

      {tab === "compare" && compare && (
        <>
          {winner && winner[1] > 0 && (
            <p className="muted" style={{ marginTop: 0 }}>
              <strong>{winner[0]}</strong> is cheaper in {winner[1]} of {compare.cats.length} categories
              {" "}(latest flyers).
            </p>
          )}
          <CompareBars compare={compare} stores={stores} />
          <div className="chips" style={{ marginTop: 8 }}>
            {stores.map((st) => (
              <span key={st} className="legend">
                <span className="dot" style={{ background: colorFor(st) }} />
                {st} · {latest[st]?.slice(5) || "—"}</span>
            ))}
          </div>
          <p className="muted small" style={{ marginTop: 6 }}>
            Average flyer price per category. Stores rarely list the exact same products, so this is a
            directional read; the matched items below are exact.
          </p>

          {matched.length > 0 && (
            <table className="match-table">
              <thead>
                <tr><th>Same item</th>{stores.map((s) => <th key={s}>{s}</th>)}</tr>
              </thead>
              <tbody>
                {matched.map((row) => {
                  const min = Math.min(...Object.values(row.prices));
                  return (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      {stores.map((s) => (
                        <td key={s} className={row.prices[s] === min ? "cheapest" : ""}>
                          {row.prices[s] != null ? eur(row.prices[s]) : "—"}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === "trend" && <TrendLines points={data.points as Pt[]} stores={stores} />}
    </div>
  );
}

// Grouped bars: category on x, one bar per store.
function CompareBars({ compare, stores }: { compare: any; stores: string[] }) {
  const { cats, byCat } = compare;
  const W = 620, H = 260, PAD = 44, GAP = 26;
  const all: number[] = [];
  for (const c of cats) for (const s of stores) if (byCat[c]?.[s] != null) all.push(byCat[c][s]);
  const maxP = Math.max(0.01, ...all) * 1.1;
  const groupW = (W - 2 * PAD - GAP * (cats.length - 1)) / cats.length;
  const barW = Math.min(46, groupW / stores.length - 4);
  const y = (p: number) => H - PAD - (p / maxP) * (H - 2 * PAD);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 640 }}>
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#ddd" />
      {[0, maxP / 2, maxP].map((p, k) => (
        <g key={k}>
          <line x1={PAD} y1={y(p)} x2={W - PAD} y2={y(p)} stroke="#f0f0f0" />
          <text x={PAD - 6} y={y(p) + 3} textAnchor="end" fontSize="10" fill="#888">{eur(p)}</text>
        </g>
      ))}
      {cats.map((cat: string, ci: number) => {
        const gx = PAD + ci * (groupW + GAP);
        const present = stores.filter((s) => byCat[cat]?.[s] != null);
        return (
          <g key={cat}>
            {present.map((s, si) => {
              const bx = gx + (groupW - present.length * (barW + 4)) / 2 + si * (barW + 4);
              const v = byCat[cat][s];
              return (
                <g key={s}>
                  <rect x={bx} y={y(v)} width={barW} height={H - PAD - y(v)}
                    rx={3} fill={colorFor(s)} />
                  <text x={bx + barW / 2} y={y(v) - 4} textAnchor="middle" fontSize="9" fill="#555">
                    {eur(v)}</text>
                </g>
              );
            })}
            <text x={gx + groupW / 2} y={H - PAD + 14} textAnchor="middle" fontSize="10" fill="#666">
              {cat}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Secondary, honest trend: per-store basket average over dates.
function TrendLines({ points, stores }: { points: Pt[]; stores: string[] }) {
  const series = useMemo(() => {
    const byStoreDate: Record<string, Record<string, { sum: number; n: number }>> = {};
    for (const p of points) {
      const sd = (byStoreDate[p.store] ||= {});
      const a = (sd[p.date] ||= { sum: 0, n: 0 });
      a.sum += p.avg_price * p.n; a.n += p.n;
    }
    const dates = [...new Set(points.map((p) => p.date))].sort();
    const lines: Record<string, { date: string; price: number }[]> = {};
    for (const s of stores) {
      const sd = byStoreDate[s] || {};
      lines[s] = Object.keys(sd).sort().map((d) => ({ date: d, price: sd[d].sum / sd[d].n }));
    }
    return { dates, lines };
  }, [points, stores]);

  const { dates, lines } = series;
  const W = 620, H = 260, PAD = 44;
  const all = Object.values(lines).flat().map((p) => p.price);
  if (!all.length) return <p className="muted">Not enough data yet.</p>;
  const minP = Math.min(...all) * 0.9, maxP = Math.max(...all) * 1.1;
  const x = (d: string) => PAD + (dates.indexOf(d) / Math.max(1, dates.length - 1)) * (W - 2 * PAD);
  const y = (p: number) => H - PAD - ((p - minP) / (maxP - minP)) * (H - 2 * PAD);
  const sparse = dates.length < 2;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 640 }}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#ddd" />
        {[minP, (minP + maxP) / 2, maxP].map((p, k) => (
          <text key={k} x={PAD - 6} y={y(p) + 3} textAnchor="end" fontSize="10" fill="#888">{eur(p)}</text>
        ))}
        {stores.map((s) => (
          <React.Fragment key={s}>
            {lines[s].length > 1 && (
              <polyline fill="none" stroke={colorFor(s)} strokeWidth="2"
                points={lines[s].map((p) => `${x(p.date)},${y(p.price)}`).join(" ")} />
            )}
            {lines[s].map((p, k) => (
              <circle key={k} cx={x(p.date)} cy={y(p.price)} r={3} fill={colorFor(s)} />
            ))}
          </React.Fragment>
        ))}
        {dates.map((d) => (
          <text key={d} x={x(d)} y={H - PAD + 14} textAnchor="middle" fontSize="9" fill="#888">
            {d.slice(5)}</text>
        ))}
      </svg>
      <div className="chips">
        {stores.map((s) => (
          <span key={s} className="legend"><span className="dot" style={{ background: colorFor(s) }} />{s}</span>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 6 }}>
        Whole-basket average price per flyer date.
        {sparse ? " Upload flyers across more weeks to see a real trend." : ""}
      </p>
    </div>
  );
}
