// Structured extraction for iPaper flyer viewers (Pingo Doce and many PT chains).
// The viewer ships a signed "Enrichments" JSON feed listing every tagged product
// with an exact price — no OCR, no AI, no PDF. We pull that directly.
import { categorize, type FlyerItem } from "./_flyer.ts";

const UA = { "user-agent": "Mozilla/5.0 (compatible; GrocereeBot/1.0)" };

// A page is an iPaper viewer if its HTML references the ipaper.io CDN.
export const looksLikeIpaper = (html: string) => /ipaper\.io/i.test(html);

// Pull the per-page-range Enrichments JSON URLs out of the (JS-escaped) viewer HTML.
function enrichmentUrls(html: string): string[] {
  const unesc = html.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  const re =
    /https:\/\/[a-z0-9.\-]*ipaper\.io\/iPaper\/Papers\/[^"'\s)]+?Page[0-9\-]+\.json\?Policy=[^"'\s)]+/gi;
  return [...new Set(unesc.match(re) || [])];
}

// Derive a coarse unit from the Portuguese product name suffix.
function unitOf(name: string): string | null {
  const n = name.toUpperCase();
  if (/\bKG\b|\/KG/.test(n)) return "kg";
  if (/\bL\b|\bLT\b|\bML\b/.test(n)) return "l";
  if (/\bUN\b|\bUNI\b/.test(n)) return "un";
  if (/\bG\b|\bGR\b|\bGRS\b/.test(n)) return "un"; // packaged-by-weight, priced per pack
  return null;
}

// PT flyers state validity as text, not a machine field. The phrasing varies by
// chain — "De 2 a 8 de Junho" (Pingo), "válidos 2 — 8 junho 2026" (Continente),
// "válido de 2 a 8 de junho". Parse any of these into ISO dates. Exported so the
// vision (image-OCR) path can read reliable dates straight from the viewer HTML
// instead of trusting the model to OCR them off a page.
const PT_MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
export function parsePtDates(html: string, viewerUrl: string): { from: string | null; to: string | null } {
  // Normalise the various dashes (en/em/figure/minus) to a plain hyphen so one
  // pattern covers "2 a 8", "2 - 8", "2 — 8".
  const h = html.replace(/[‐-―−]/g, "-");
  // <day> (a|-|até) <day> [de] <month> [year]. The month name is what anchors it
  // and disambiguates from stray "2 a 8" numbers; we validate it against PT_MONTHS.
  const re = /(\d{1,2})\s*(?:a|-|até)\s*(\d{1,2})\s+(?:de\s+)?([a-zçãâé]+)\.?(?:\s+(?:de\s+)?(\d{4}))?/gi;
  const yrFromUrl = +(viewerUrl.match(/\/(20\d\d)(?:\/|$)/)?.[1] ?? 0);
  for (const m of h.matchAll(re)) {
    const mon = PT_MONTHS[m[3].toLowerCase()];
    if (!mon) continue;
    const d1 = +m[1], d2 = +m[2];
    if (d1 < 1 || d1 > 31 || d2 < 1 || d2 > 31) continue;
    const yr = +(m[4] || yrFromUrl || new Date().getFullYear());
    // The named month belongs to the end date; if the range crosses a month
    // boundary (start day > end day) the start sits in the previous month.
    let fromMon = mon, fromYr = yr;
    if (d1 > d2) { fromMon = mon === 1 ? 12 : mon - 1; if (mon === 1) fromYr = yr - 1; }
    const iso = (y: number, mo: number, d: number) =>
      `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return { from: iso(fromYr, fromMon, d1), to: iso(yr, mon, d2) };
  }
  return { from: null, to: null };
}

export interface IpaperResult {
  items: FlyerItem[];
  pageCount: number;
  validFrom: string | null;
  validTo: string | null;
}

// Fetch an iPaper viewer URL and return its priced products.
export async function extractIpaper(viewerUrl: string): Promise<IpaperResult> {
  const html = await (await fetch(viewerUrl, { headers: UA })).text();
  const { from: validFrom, to: validTo } = parsePtDates(html, viewerUrl);
  const urls = enrichmentUrls(html);
  if (!urls.length) return { items: [], pageCount: 0, validFrom, validTo };

  const seen = new Set<string>();
  const items: FlyerItem[] = [];
  let pageCount = 0;

  for (const u of urls) {
    let j: any;
    try {
      j = await (await fetch(u, { headers: UA })).json();
    } catch {
      continue;
    }
    for (const e of j.enrichments || []) {
      const name = (e.name || e.desc || "").trim();
      if (!name || typeof e.price !== "number" || e.price <= 0) continue;
      if (typeof e.pageIndex === "number") pageCount = Math.max(pageCount, e.pageIndex + 1);
      if (!categorize(name)) continue; // skip non-grocery (homeware, electronics, clothing)
      const key = `${name}|${e.price}`;
      if (seen.has(key)) continue; // enrichments repeat across spreads
      seen.add(key);
      items.push({
        name,            // keep Portuguese — matches shelves and cross-store names exactly
        name_pt: name,
        unit: unitOf(name),
        price: e.price,
        normal_price: null,
        discount: null,
        good_value: false,
      });
    }
  }
  return { items, pageCount, validFrom, validTo };
}
