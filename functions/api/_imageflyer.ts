// Vision extraction for image-only iPaper flyer viewers (Intermarché, Aldi).
// These ship no structured price feed — prices live only inside the page images.
// We render the viewer to find one page-image URL, derive every page from it
// (each page is the same URL with one number swapped), then OCR the pages with
// Gemini vision (shared logic in _vision.ts).
import { firecrawl } from "./_firecrawl.ts";
import { type ParsedFlyer } from "./_flyer.ts";
import { parsePtDates } from "./_ipaper.ts";
import { b64, ocrPages, VISION_MAX_PAGES } from "./_vision.ts";

const UA = { "user-agent": "Mozilla/5.0 (compatible; GrocereeBot/1.0)" };

// Page-image URL shapes. Each is the same URL with one page number swapped, so
// one sample yields the whole flyer. (Intermarché signs with a wildcard policy
// covering every page; Aldi's Image.ashx is unsigned.)
//   swap   — same image, different page number.
//   normal — same image at "Normal" resolution instead of "Zoom". Normal is ~half
//            the bytes of Zoom and still legible for OCR; halving the bytes halves
//            the per-page base64/JSON CPU, which is what keeps one page under the
//            Worker CPU limit. The wildcard token signs the Pages/ prefix, so the
//            Normal variant validates with the same token.
const PATTERNS: {
  re: RegExp;
  swap: (u: string, from: number, to: number) => string;
  normal: (u: string) => string;
}[] = [
  { re: /https:\/\/[a-z0-9.\-]*ipaper\.io\/iPaper\/Papers\/[^"'\s)\\]+?\/Pages\/(\d+)\/[A-Za-z]+\.jpe?g[^"'\s)\\]*/i,
    swap: (u, f, t) => u.replace(`/Pages/${f}/`, `/Pages/${t}/`),
    normal: (u) => u.replace(/(\/Pages\/\d+\/)[A-Za-z]+(\.jpe?g)/i, "$1Normal$2") },
  { re: /https:\/\/[a-z0-9.\-]*ipapercms\.dk\/[^"'\s)\\]+?Image\.ashx\?PageNumber=(\d+)[^"'\s)\\]*/i,
    swap: (u, f, t) => u.replace(`PageNumber=${f}`, `PageNumber=${t}`),
    normal: (u) => /ImageType=/i.test(u) ? u.replace(/ImageType=[A-Za-z]+/i, "ImageType=Normal") : `${u}&ImageType=Normal` },
];

// Render the viewer; return one page-image URL plus how to swap its page number.
async function findTemplate(fcKey: string, viewerUrl: string) {
  const data = await firecrawl(fcKey, viewerUrl, ["rawHtml"], 6000);
  const html = (data?.data?.rawHtml || "")
    .replace(/\\u0026/g, "&").replace(/\\\//g, "/").replace(/&amp;/g, "&");
  for (const p of PATTERNS) {
    const m = html.match(p.re);
    if (m) return { sample: m[0], from: Number(m[1]), swap: p.swap, normal: p.normal, html };
  }
  return null;
}

// List a flyer's page-image URLs (Normal res) without OCRing them — cheap CPU, no
// base64. The browser then OCRs one page per /api/ocr-page request so each Worker
// call stays under the CPU limit. Probes pages 1..N, stopping at the first gap.
export async function listImageFlyerPages(
  fcKey: string, viewerUrl: string,
): Promise<{ from: string | null; to: string | null; pages: string[] }> {
  const tpl = await findTemplate(fcKey, viewerUrl);
  if (!tpl) throw new Error("no page images found in viewer");
  const { from, to } = parsePtDates(tpl.html, viewerUrl);
  const pages: string[] = [];
  for (let k = 1; k <= VISION_MAX_PAGES; k++) {
    const u = tpl.normal(tpl.swap(tpl.sample, tpl.from, k));
    let ok = false;
    try {
      const res = await fetch(u, { headers: UA }); // body discarded — existence check only, no base64
      ok = res.ok && (res.headers.get("content-type") || "").toLowerCase().startsWith("image/");
    } catch { /* network miss = treat as gap */ }
    if (!ok) break;
    pages.push(u);
  }
  return { from, to, pages };
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
  // Prefer dates read straight from the viewer HTML (reliable) over the model's
  // OCR of them; ocrPages keeps any seed dates and only fills gaps from Gemini.
  const { from, to } = parsePtDates(tpl.html, viewerUrl);
  return ocrPages(geminiKey, media, storeName, from, to);
}
