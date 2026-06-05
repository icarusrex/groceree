import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.ts";
import { useStore } from "../store.tsx";

// Categories the diet rules out, so the price comparison reflects what you'd buy
// (a dairy-free shopper shouldn't be told a store wins on cheap dairy).
function blockedCats(diet: string[]): Set<string> {
  const b = new Set<string>();
  if (diet.includes("dairy_free")) b.add("dairy");
  if (diet.includes("vegetarian")) { b.add("meat"); b.add("fish"); }
  if (diet.includes("pescatarian")) b.add("meat");
  return b;
}

// Distinct qualitative palette (colourblind-friendly, Tableau-ish). Brand colours
// are unusable here: Lidl, Continente and Intermarché are all near-identical red,
// so three stores looked the same. Assign by store, sorted for a stable mapping.
const PALETTE = ["#4e79a7", "#f28e2b", "#59a14f", "#e15759", "#b07aa1", "#76b7b2", "#edc948", "#9c755f"];
const buildColors = (stores: string[]): Record<string, string> => {
  const m: Record<string, string> = {};
  [...stores].sort().forEach((s, i) => { m[s] = PALETTE[i % PALETTE.length]; });
  return m;
};

const CAT_ORDER = ["produce", "meat", "fish", "dairy", "pantry"];
const eur = (n: number) => "€" + n.toFixed(2);

type Pt = { date: string; store: string; category: string; avg_price: number; n: number };
type Item = { store: string; name: string; price: number; date: string; cat: string };
type Colors = Record<string, string>;

// Small floating tooltip driven by mouse position relative to a wrapper div.
function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; node: React.ReactNode } | null>(null);
  const show = (e: React.MouseEvent, node: React.ReactNode) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, node });
  };
  const hide = () => setTip(null);
  return { ref, tip, show, hide };
}

export default function PriceTrends() {
  const store = useStore();
  const [raw, setRaw] = useState<any>(null);
  const [tab, setTab] = useState<"compare" | "trend">("compare");
  // Which store is spotlighted (hovered in a chart or legend); dims the others.
  const [hov, setHov] = useState<string | null>(null);

  useEffect(() => { api.prices().then(setRaw).catch(() => setRaw({ count: 0, points: [], items: [] })); }, []);

  // Drop diet-excluded categories from the comparison (e.g. dairy when dairy-free).
  const data = useMemo(() => {
    if (!raw) return raw;
    const blocked = blockedCats(store.settings.diet || []);
    if (!blocked.size) return raw;
    return {
      ...raw,
      points: (raw.points || []).filter((p: any) => !blocked.has(p.category)),
      items: (raw.items || []).filter((it: any) => !blocked.has(it.cat)),
    };
  }, [raw, store.settings.diet]);

  const colors = useMemo(() => buildColors((data?.stores || []) as string[]), [data]);

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
          No flyer prices yet. On Meal Plan, hit “Find flyers online” (or “Upload flyer”) and
          this builds a store-vs-store price comparison plus trends over time.
        </p>
      </div>
    );
  }

  const stores: string[] = data.stores;
  const winner = compare && Object.entries(compare.wins).sort((a, b) => b[1] - a[1])[0];

  // Legend whose items spotlight a store on hover.
  const Legend = ({ withDate }: { withDate?: boolean }) => (
    <div className="chips legend-row">
      {stores.map((st) => (
        <span key={st}
          className={"legend" + (hov && hov !== st ? " dim" : "") + (hov === st ? " on" : "")}
          onMouseEnter={() => setHov(st)} onMouseLeave={() => setHov(null)}>
          <span className="dot" style={{ background: colors[st] }} />
          {st}{withDate ? ` · ${latest[st]?.slice(5) || "—"}` : ""}</span>
      ))}
    </div>
  );

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
          <CompareBars compare={compare} stores={stores} colors={colors} hov={hov} setHov={setHov} />
          <Legend withDate />
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

      {tab === "trend" && (
        <>
          <TrendLines points={data.points as Pt[]} stores={stores} colors={colors} hov={hov} setHov={setHov} />
          <Legend />
          <p className="muted small" style={{ marginTop: 6 }}>Whole-basket average price per flyer date.</p>
        </>
      )}
    </div>
  );
}

// Grouped bars: category on x, one bar per store. Hover a bar to spotlight its
// store and read the exact value.
function CompareBars({ compare, stores, colors, hov, setHov }:
  { compare: any; stores: string[]; colors: Colors; hov: string | null; setHov: (s: string | null) => void }) {
  const { cats, byCat } = compare;
  const { ref, tip, show, hide } = useTip();
  const W = 620, H = 260, PAD = 44, GAP = 26;
  const all: number[] = [];
  for (const c of cats) for (const s of stores) if (byCat[c]?.[s] != null) all.push(byCat[c][s]);
  const maxP = Math.max(0.01, ...all) * 1.1;
  const groupW = (W - 2 * PAD - GAP * (cats.length - 1)) / cats.length;
  const barW = Math.min(46, groupW / stores.length - 4);
  const y = (p: number) => H - PAD - (p / maxP) * (H - 2 * PAD);

  return (
    <div ref={ref} className="chart-wrap" onMouseLeave={() => { hide(); setHov(null); }}>
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
          // Label only the cheapest bar per category (the "who's cheaper" point) —
          // five overlapping price labels per group were unreadable. The rest are
          // one hover away.
          const cheapest = present.reduce((a, b) => (byCat[cat][b] < byCat[cat][a] ? b : a), present[0]);
          return (
            <g key={cat}>
              {present.map((s, si) => {
                const bx = gx + (groupW - present.length * (barW + 4)) / 2 + si * (barW + 4);
                const v = byCat[cat][s];
                const dim = hov && hov !== s;
                const isMin = s === cheapest && present.length > 1;
                return (
                  <g key={s} opacity={dim ? 0.22 : 1} style={{ transition: "opacity .12s" }}
                    onMouseMove={(e) => { setHov(s); show(e, <><b>{s}</b> · {cat}<br />{eur(v)}</>); }}>
                    <rect x={bx} y={y(v)} width={barW} height={H - PAD - y(v)} rx={3}
                      fill={colors[s]} stroke={hov === s ? "#222" : "none"} strokeWidth={hov === s ? 1.5 : 0}
                      style={{ cursor: "pointer" }} />
                    {(isMin || hov === s) && (
                      <text x={bx + barW / 2} y={y(v) - 5} textAnchor="middle" fontSize="10"
                        fontWeight={isMin ? 700 : 400} fill={isMin ? "#0f6e56" : "#555"}>
                        {eur(v)}</text>
                    )}
                  </g>
                );
              })}
              <text x={gx + groupW / 2} y={H - PAD + 14} textAnchor="middle" fontSize="10" fill="#666">
                {cat}</text>
            </g>
          );
        })}
      </svg>
      {tip && <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>{tip.node}</div>}
    </div>
  );
}

// Secondary, honest trend: per-store basket average over dates. Hover a point to
// read its value; hovering a series (or legend) dims the rest.
function TrendLines({ points, stores, colors, hov, setHov }:
  { points: Pt[]; stores: string[]; colors: Colors; hov: string | null; setHov: (s: string | null) => void }) {
  const { ref, tip, show, hide } = useTip();
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
    <div ref={ref} className="chart-wrap" onMouseLeave={() => { hide(); setHov(null); }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 640 }}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#ddd" />
        {[minP, (minP + maxP) / 2, maxP].map((p, k) => (
          <g key={k}>
            <line x1={PAD} y1={y(p)} x2={W - PAD} y2={y(p)} stroke="#f4f4f4" />
            <text x={PAD - 6} y={y(p) + 3} textAnchor="end" fontSize="10" fill="#888">{eur(p)}</text>
          </g>
        ))}
        {stores.map((s) => {
          const dim = hov && hov !== s;
          return (
            <g key={s} opacity={dim ? 0.18 : 1} style={{ transition: "opacity .12s" }}
              onMouseEnter={() => setHov(s)}>
              {lines[s].length > 1 && (
                <polyline fill="none" stroke={colors[s]} strokeWidth={hov === s ? 3.5 : 2}
                  strokeLinejoin="round" strokeLinecap="round"
                  points={lines[s].map((p) => `${x(p.date)},${y(p.price)}`).join(" ")} />
              )}
              {lines[s].map((p, k) => (
                <circle key={k} cx={x(p.date)} cy={y(p.price)} r={hov === s ? 5 : 3.5}
                  fill={colors[s]} stroke="#fff" strokeWidth={1} style={{ cursor: "pointer" }}
                  onMouseMove={(e) => { setHov(s); show(e, <><b>{s}</b> · {p.date.slice(5)}<br />{eur(p.price)}</>); }} />
              ))}
            </g>
          );
        })}
        {dates.map((d) => (
          <text key={d} x={x(d)} y={H - PAD + 14} textAnchor="middle" fontSize="9" fill="#888">
            {d.slice(5)}</text>
        ))}
      </svg>
      {tip && <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>{tip.node}</div>}
      {sparse && <p className="muted small" style={{ marginTop: 2 }}>
        Upload flyers across more weeks to see a real trend.</p>}
    </div>
  );
}
