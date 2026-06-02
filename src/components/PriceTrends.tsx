import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.ts";

const COLORS: Record<string, string> = {
  meat: "#e24b4a", fish: "#185fa5", dairy: "#b8860b",
  produce: "#0f6e56", pantry: "#8b5cf6",
};

export default function PriceTrends() {
  const [data, setData] = useState<any>(null);
  const [store, setStore] = useState<string>("");

  useEffect(() => { api.prices().then(setData).catch(() => setData({ count: 0, points: [] })); }, []);

  const series = useMemo(() => {
    if (!data?.points?.length) return null;
    const pts = store ? data.points.filter((p: any) => p.store === store) : data.points;
    // group by category -> sorted [date, price]
    const byCat: Record<string, { date: string; price: number }[]> = {};
    for (const p of pts) (byCat[p.category] ||= []).push({ date: p.date, price: p.avg_price });
    for (const c in byCat) byCat[c].sort((a, b) => a.date.localeCompare(b.date));
    const dates = [...new Set(pts.map((p: any) => p.date))].sort();
    return { byCat, dates };
  }, [data, store]);

  if (!data) return <p className="muted">Loading price data…</p>;

  // honest sparse-data state — evaluated against the CURRENTLY SELECTED store,
  // not globally, so picking one store with a single flyer date is handled right.
  const selDates = series ? (series.dates as string[]).length : 0;
  if (!data.count || !series || selDates < 1) {
    return (
      <div className="trend-empty">
        <p className="muted">
          {data.count ? `${data.count} prices loaded${store ? ` · none yet for ${store}` : ""}.`
            : "No flyer prices yet."}
          {" "}Upload flyers over time (Meal Plan → “From flyer”) and a line per category
          builds up here. A single flyer shows as points; two or more dates draw trend lines.
        </p>
      </div>
    );
  }
  const singleDate = selDates < 2;

  // build SVG
  const W = 620, H = 260, PAD = 40;
  const allPrices = (data.points as any[]).map((p) => p.avg_price);
  const minP = Math.min(...allPrices) * 0.9, maxP = Math.max(...allPrices) * 1.1;
  const dates = series!.dates as string[];
  const x = (d: string) => PAD + (dates.indexOf(d) / Math.max(1, dates.length - 1)) * (W - 2 * PAD);
  const y = (p: number) => H - PAD - ((p - minP) / (maxP - minP)) * (H - 2 * PAD);

  return (
    <div>
      <div className="chips" style={{ marginBottom: 10 }}>
        <button className={!store ? "chip on" : "chip"} onClick={() => setStore("")}>All stores</button>
        {data.stores.map((st: string) => (
          <button key={st} className={store === st ? "chip on" : "chip"}
            onClick={() => setStore(st)}>{st}</button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 640 }}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#ddd" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#ddd" />
        {[minP, (minP + maxP) / 2, maxP].map((p, k) => (
          <text key={k} x={PAD - 6} y={y(p) + 3} textAnchor="end" fontSize="10" fill="#888">€{p.toFixed(2)}</text>
        ))}
        {Object.entries(series!.byCat).map(([cat, pts]) => (
          <React.Fragment key={cat}>
            {!singleDate && (
              <polyline fill="none" stroke={COLORS[cat] || "#666"} strokeWidth="2"
                points={(pts as any[]).map((p) => `${x(p.date)},${y(p.price)}`).join(" ")} />
            )}
            {(pts as any[]).map((p, k) => (
              <circle key={k} cx={x(p.date)} cy={y(p.price)} r={singleDate ? 4 : 2.5}
                fill={COLORS[cat] || "#666"} />
            ))}
          </React.Fragment>
        ))}
        {dates.map((d) => (
          <text key={d} x={x(d)} y={H - PAD + 14} textAnchor="middle" fontSize="9" fill="#888">
            {d.slice(5)}</text>
        ))}
      </svg>
      <div className="chips">
        {Object.keys(series!.byCat).map((cat) => (
          <span key={cat} className="legend">
            <span className="dot" style={{ background: COLORS[cat] || "#666" }} />{cat}</span>
        ))}
      </div>
    </div>
  );
}
