import { json, type Env } from "./_helpers.ts";
import { SOURCES, sourceById, type StoreSource } from "./_sources.ts";

// POST /api/discover-flyers  { store_id? }
// Scrapes each store's landing page (via Firecrawl, which gets past anti-bot)
// and returns the current flyer viewer URLs. No DB writes — pure discovery.
// The user then picks which flyers to fetch & parse.

interface Found {
  store_id: string;
  store_name: string;
  kind: StoreSource["kind"];
  landing: string;
  flyers: { url: string; title: string }[];
  note?: string;
}

async function firecrawl(key: string, url: string) {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ url, formats: ["markdown", "links"], onlyMainContent: false }),
  });
  if (!res.ok) throw new Error(`firecrawl ${res.status}: ${await res.text()}`);
  return res.json<any>();
}

// Title a flyer viewer URL from its last meaningful path segment.
const titleFromUrl = (u: string) => {
  try {
    const segs = new URL(u).pathname.split("/").filter(Boolean);
    const last = segs.reverse().find((s) => /[a-z]/i.test(s)) || segs[0] || "Flyer";
    return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch { return "Flyer"; }
};

// ISO-8601 week number (Mon-based), for ranking flyers by recency.
function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((date.getTime() - firstThu.getTime()) / (7 * 86400000));
}
const weekLabel = (w: number, cur: number) =>
  w < 0 ? "Flyer" : w === cur ? "This week" : w === cur + 1 ? "Next week" : `Week ${w}`;

// From the raw flyer links keep only this store's weekly grocery flyer for the
// mainland, this week + next week (one per week). Stores that don't declare a
// weeklyRe fall back to the old "first 12 links" behaviour.
function pickWeekly(src: StoreSource, links: string[]): { url: string; title: string }[] {
  if (!src.weeklyRe) return links.slice(0, 12).map((url) => ({ url, title: titleFromUrl(url) }));
  const weekly = links.filter((l) => src.weeklyRe!.test(l) && !(src.excludeRe && src.excludeRe.test(l)));
  const byWeek = new Map<number, string>();
  for (const l of weekly) {
    const w = src.weekRe ? Number(l.match(src.weekRe)?.[1] ?? NaN) : NaN;
    const key = Number.isFinite(w) ? w : -1;
    if (!byWeek.has(key)) byWeek.set(key, l); // first (best) url for that week
  }
  const cur = isoWeek(new Date());
  const weeks = [...byWeek.keys()];
  const future = weeks.filter((w) => w >= cur).sort((a, b) => a - b);
  const chosen = future.length ? future.slice(0, 2) : weeks.sort((a, b) => b - a).slice(0, 1);
  return chosen.map((w) => ({ url: byWeek.get(w)!, title: weekLabel(w, cur) }));
}

async function discover(src: StoreSource, key: string): Promise<Found> {
  const base: Found = {
    store_id: src.id, store_name: src.name, kind: src.kind,
    landing: src.landing, flyers: [],
  };
  if (src.kind !== "ipaper" || !src.flyerHost) {
    return { ...base, note: "Open the store page and upload the flyer (auto-parse not wired for this store yet)." };
  }
  try {
    const data = await firecrawl(key, src.landing);
    const links: string[] = data?.data?.links || [];
    const hits = [...new Set(links.filter((l) => l.includes(src.flyerHost!)))]
      // drop obvious non-flyer asset links
      .filter((l) => !/\.(png|jpe?g|css|js|ico|svg|gif|webp)(\?|$)/i.test(l));
    base.flyers = pickWeekly(src, hits);
    if (!base.flyers.length) base.note = "No current grocery flyer found on the landing page.";
  } catch (e: any) {
    base.note = `Discovery failed: ${e.message}`;
  }
  return base;
}

// GET — the source registry (for store-selection checkboxes; no scraping).
export const onRequestGet: PagesFunction<Env> = async () =>
  json({ sources: SOURCES.map((s) => ({ store_id: s.id, store_name: s.name, kind: s.kind })) });

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.FIRECRAWL_API_KEY) return json({ error: "FIRECRAWL_API_KEY not set" }, 500);
  const body = await ctx.request.json<any>().catch(() => ({}));
  // store_ids (array) wins; store_id (single) kept for back-compat; else all.
  const ids: string[] = Array.isArray(body.store_ids) ? body.store_ids
    : body.store_id ? [body.store_id] : [];
  const list = ids.length
    ? ids.map(sourceById).filter(Boolean) as StoreSource[]
    : SOURCES;
  const results = await Promise.all(list.map((s) => discover(s, ctx.env.FIRECRAWL_API_KEY)));
  return json({ stores: results });
};
