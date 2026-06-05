// Shared vision-OCR helpers for flyers that ship no structured price feed
// (prices live only inside page images). Used by both the iPaper-image stores
// (Intermarché, Aldi — page URLs derived by number) and the Schwarz leaflet
// platform (Lidl — page URLs listed in a JSON manifest).
import { geminiParse, type FlyerItem, type ParsedFlyer } from "./_flyer.ts";

const UA = { "user-agent": "Mozilla/5.0 (compatible; GrocereeBot/1.0)" };
export const VISION_MAX_PAGES = 20; // grocery deals are front-loaded; cap cost + latency
const BATCH = 5;                    // page images per Gemini vision call

export function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// Fetch an explicit list of page-image URLs (e.g. from a manifest). Skips any
// URL that doesn't return an image.
export async function mediaFromUrls(urls: string[]): Promise<{ mime: string; data: string }[]> {
  const out: { mime: string; data: string }[] = [];
  for (const u of urls) {
    let res: Response;
    try { res = await fetch(u, { headers: UA }); } catch { continue; }
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok || !ct.startsWith("image/")) continue;
    out.push({ mime: ct.split(";")[0], data: b64(await res.arrayBuffer()) });
  }
  return out;
}

// OCR page images in small batches and merge into one ParsedFlyer (deduping
// repeated products across pages). validFrom/validTo seed the result when the
// caller already knows them (e.g. from a manifest); otherwise Gemini supplies them.
export async function ocrPages(
  geminiKey: string,
  media: { mime: string; data: string }[],
  storeName: string,
  validFrom: string | null = null,
  validTo: string | null = null,
): Promise<ParsedFlyer> {
  const items: FlyerItem[] = [];
  const seen = new Set<string>();
  let store = storeName, summary: string | null = null;

  for (let i = 0; i < media.length; i += BATCH) {
    let parsed: ParsedFlyer;
    try { parsed = await geminiParse(geminiKey, media.slice(i, i + BATCH)); } catch { continue; }
    store = parsed.store || store;
    validFrom = validFrom || parsed.valid_from || null;
    validTo = validTo || parsed.valid_to || null;
    summary = summary || parsed.summary || null;
    for (const it of parsed.items || []) {
      if (!it?.name || typeof it.price !== "number") continue;
      const key = `${it.name.toLowerCase()}|${it.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(it);
    }
  }

  return {
    store,
    valid_from: validFrom,
    valid_to: validTo,
    summary: summary || `${items.length} grocery deals from this week's flyer (${media.length} pages).`,
    items,
    page_count: media.length,
  };
}
