// Vision extraction for image-only iPaper flyer viewers (Intermarché, Aldi).
// These ship no structured price feed — prices live only inside the page images.
// We render the viewer to find one page-image URL, derive every page from it
// (each page is the same URL with one number swapped), then OCR the pages with
// Gemini vision (shared logic in _vision.ts).
import { firecrawl } from "./_firecrawl.ts";
import { type ParsedFlyer } from "./_flyer.ts";
import { b64, ocrPages, VISION_MAX_PAGES } from "./_vision.ts";

const UA = { "user-agent": "Mozilla/5.0 (compatible; GrocereeBot/1.0)" };

// Page-image URL shapes. Each is the same URL with one page number swapped, so
// one sample yields the whole flyer. (Intermarché signs with a wildcard policy
// covering every page; Aldi's Image.ashx is unsigned.)
const PATTERNS: { re: RegExp; swap: (u: string, from: number, to: number) => string }[] = [
  { re: /https:\/\/[a-z0-9.\-]*ipaper\.io\/iPaper\/Papers\/[^"'\s)\\]+?\/Pages\/(\d+)\/[A-Za-z]+\.jpe?g[^"'\s)\\]*/i,
    swap: (u, f, t) => u.replace(`/Pages/${f}/`, `/Pages/${t}/`) },
  { re: /https:\/\/[a-z0-9.\-]*ipapercms\.dk\/[^"'\s)\\]+?Image\.ashx\?PageNumber=(\d+)[^"'\s)\\]*/i,
    swap: (u, f, t) => u.replace(`PageNumber=${f}`, `PageNumber=${t}`) },
];

// Render the viewer; return one page-image URL plus how to swap its page number.
async function findTemplate(fcKey: string, viewerUrl: string) {
  const data = await firecrawl(fcKey, viewerUrl, ["rawHtml"], 6000);
  const html = (data?.data?.rawHtml || "")
    .replace(/\\u0026/g, "&").replace(/\\\//g, "/").replace(/&amp;/g, "&");
  for (const p of PATTERNS) {
    const m = html.match(p.re);
    if (m) return { sample: m[0], from: Number(m[1]), swap: p.swap };
  }
  return null;
}

// Fetch page images 1..VISION_MAX_PAGES, stopping at the first gap (= past the flyer).
async function fetchPages(tpl: { sample: string; from: number; swap: (u: string, f: number, t: number) => string }) {
  const media: { mime: string; data: string }[] = [];
  for (let k = 1; k <= VISION_MAX_PAGES; k++) {
    let res: Response;
    try { res = await fetch(tpl.swap(tpl.sample, tpl.from, k), { headers: UA }); } catch { break; }
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok || !ct.startsWith("image/")) break;
    media.push({ mime: ct.split(";")[0], data: b64(await res.arrayBuffer()) });
  }
  return media;
}

export async function extractImageFlyer(
  fcKey: string, geminiKey: string, viewerUrl: string, storeName: string,
): Promise<ParsedFlyer> {
  const tpl = await findTemplate(fcKey, viewerUrl);
  if (!tpl) throw new Error("no page images found in viewer");
  const media = await fetchPages(tpl);
  if (!media.length) throw new Error("page images did not load");
  return ocrPages(geminiKey, media, storeName);
}
