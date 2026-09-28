import { json, uid, type Env } from "./_helpers.ts";
import { firecrawl } from "./_firecrawl.ts";
import { BROWSER } from "./_sfcc.ts";
import { SOURCES, sourceById, sourcesForCountry, type StoreSource } from "./_sources.ts";

const userCountry = async (env: Env, user: string): Promise<string> => {
  const row = await env.DB.prepare("SELECT country FROM user_settings WHERE user_id=?")
    .bind(user).first<{ country: string }>().catch(() => null);
  return row?.country || "PT";
};

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
  const now = new Date();
  const cur = isoWeek(now);
  const weeks = [...byWeek.keys()];
  const future = weeks.filter((w) => w >= cur).sort((a, b) => a - b);
  let chosen: number[];
  if (now.getDay() === 0) {
    // Sunday: the current week ends today, so plan NEXT week. Prefer next week's
    // flyer; fall back to the current one only if next isn't published yet.
    const next = future.filter((w) => w > cur);
    chosen = next.length ? next.slice(0, 1) : future.slice(0, 1);
  } else {
    chosen = future.length ? future.slice(0, 1) : weeks.sort((a, b) => b - a).slice(0, 1);
  }
  return chosen.map((w) => ({ url: byWeek.get(w)!, title: weekLabel(w, cur) }));
}

// Leaflet (Schwarz/Lidl) slugs carry a DD-MM start date, not an ISO week number.
// Rank by that date: keep the most recent flyer whose start date is on/before
// today (the active one), plus next week's on Sundays. Falls back to whatever's
// newest if nothing has started yet.
function pickLeaflet(src: StoreSource, links: string[]): { url: string; title: string }[] {
  const weekly = links.filter((l) => src.weeklyRe!.test(l) && !(src.excludeRe && src.excludeRe.test(l)));
  const now = new Date();
  const yr = now.getFullYear();
  // Parse DD-MM → a Date this year (roll to next year if it's far in the past,
  // so a January flyer ranks ahead of a December one near the year boundary).
  const dateOf = (l: string): number => {
    const m = l.match(src.weekRe!);
    if (!m) return NaN;
    const [dd, mm] = m[1].split("-").map(Number);
    let t = Date.UTC(yr, mm - 1, dd);
    if (t < now.getTime() - 300 * 86400000) t = Date.UTC(yr + 1, mm - 1, dd);
    return t;
  };
  // First (best) url per distinct start date.
  const byDate = new Map<number, string>();
  for (const l of weekly) {
    const t = dateOf(l);
    if (!Number.isFinite(t)) continue;
    if (!byDate.has(t)) byDate.set(t, l);
  }
  if (!byDate.size) return [];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dates = [...byDate.keys()].sort((a, b) => a - b);
  const started = dates.filter((t) => t <= today);
  const future = dates.filter((t) => t > today);
  const chosen: number[] = [];
  if (now.getDay() === 0 && future.length) {
    chosen.push(future[0]);                          // Sunday: next week's leaflet
  } else if (started.length) {
    chosen.push(started[started.length - 1]);        // active flyer
  } else if (future.length) {
    chosen.push(future[0]);                          // nothing live yet
  }
  if (!chosen.length && started.length) chosen.push(started[started.length - 1]); // fallback
  const seen = new Set<number>();
  return chosen.filter((t) => !seen.has(t) && seen.add(t)).map((t) => {
    const label = t <= today ? "This week" : "Next week";
    return { url: byDate.get(t)!, title: label };
  });
}

async function discover(src: StoreSource, key: string): Promise<Found> {
  const base: Found = {
    store_id: src.id, store_name: src.name, kind: src.kind,
    landing: src.landing, flyers: [],
  };

  // Image-only iPaper viewers (Intermarché, Aldi) — discovery only locates the
  // viewer URL(s); fetch-flyer renders + OCRs the page images.
  if (src.kind === "ipaper-image") {
    // Fixed viewer URLs (Aldi: this-week / next-week pages are static).
    if (src.staticViewers) {
      const sunday = new Date().getDay() === 0;
      // On Sunday plan next week — use the next-week page only, if there is one;
      // otherwise (and on other days) use the regular this-week page(s).
      const nextOnly = src.staticViewers.filter((v) => v.sundayOnly);
      const picked = sunday && nextOnly.length ? nextOnly : src.staticViewers.filter((v) => !v.sundayOnly);
      base.flyers = picked.map((v) => ({ url: v.url, title: v.title }));
      return base;
    }
    // Render a catalogue page and rank the week-dated viewer links.
    if (src.viewerLanding && src.viewerRe) {
      try {
        const data = await firecrawl(key, src.viewerLanding, ["links", "rawHtml"], 6000);
        const links: string[] = data?.data?.links || [];
        const html: string = (data?.data?.rawHtml || "").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
        const fromHtml = html.match(new RegExp(src.viewerRe.source, "gi")) || [];
        const all = [...new Set([...links, ...fromHtml])].filter((l) => src.viewerRe!.test(l));
        base.flyers = pickWeekly(src, all);
        if (!base.flyers.length) base.note = "No current grocery flyer found on the catalogue page.";
      } catch (e: any) {
        base.note = `Discovery failed: ${e.message}`;
      }
      return base;
    }
    return { ...base, note: "Image flyer source misconfigured." };
  }

  // Schwarz leaflet platform (Lidl) — render the folhetos hub, rank week-dated
  // viewer slugs by their start date. fetch-flyer reads the manifest + OCRs.
  if (src.kind === "leaflet" && src.viewerLanding && src.viewerRe) {
    try {
      const data = await firecrawl(key, src.viewerLanding, ["links", "rawHtml"], 6000);
      const links: string[] = data?.data?.links || [];
      const html: string = (data?.data?.rawHtml || "").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
      const fromHtml = html.match(new RegExp(src.viewerRe.source, "gi")) || [];
      const all = [...new Set([...links, ...fromHtml])].filter((l) => src.viewerRe!.test(l));
      base.flyers = pickLeaflet(src, all);
      if (!base.flyers.length) base.note = "No current grocery flyer found on the folhetos page.";
    } catch (e: any) {
      base.note = `Discovery failed: ${e.message}`;
    }
    return base;
  }

  // Shop-grid flyer (Auchan): the hub links the weekly flyer category in plain
  // HTML; take the highest week number (Auchan only lists the live one or two).
  if (src.kind === "sfcc" && src.viewerRe) {
    try {
      const res = await fetch(src.landing, { headers: BROWSER });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const re = new RegExp(src.viewerRe.source, "gi");
      const best = [...html.matchAll(re)].sort((a, b) => Number(b[1]) - Number(a[1]))[0];
      if (best) base.flyers = [{ url: new URL(best[0], src.landing).href, title: `Week ${best[1]}` }];
      else base.note = "No weekly flyer found on the folhetos page.";
    } catch (e: any) {
      base.note = `Discovery failed: ${e.message}`;
    }
    return base;
  }

  // Structured iPaper viewers (Pingo Doce, Continente) — list weekly flyers.
  if (src.kind === "ipaper" && src.flyerHost) {
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

  return { ...base, note: "Open the store page and upload the flyer (auto-parse not wired for this store yet)." };
}

// GET — the source registry (for store-selection checkboxes; no scraping).
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const list = sourcesForCountry(await userCountry(ctx.env, uid(ctx)));
  return json({ sources: list.map((s) => ({ store_id: s.id, store_name: s.name, kind: s.kind, landing: s.landing })) });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.FIRECRAWL_API_KEY) return json({ error: "FIRECRAWL_API_KEY not set" }, 500);
  const body = await ctx.request.json<any>().catch(() => ({}));
  // store_ids (array) wins; store_id (single) kept for back-compat; else all.
  const ids: string[] = Array.isArray(body.store_ids) ? body.store_ids
    : body.store_id ? [body.store_id] : [];
  const list = ids.length
    ? ids.map(sourceById).filter(Boolean) as StoreSource[]
    : sourcesForCountry(await userCountry(ctx.env, uid(ctx)));
  const results = await Promise.all(list.map((s) => discover(s, ctx.env.FIRECRAWL_API_KEY)));
  return json({ stores: results });
};
