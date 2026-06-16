// Shared vision-OCR helpers for flyers that ship no structured price feed
// (prices live only inside page images). Used by both the iPaper-image stores
// (Intermarché, Aldi — page URLs derived by number) and the Schwarz leaflet
// platform (Lidl — page URLs listed in a JSON manifest).
import { geminiParse, type FlyerItem, type ParsedFlyer } from "./_flyer.ts";

// A real browser header set. The Schwarz imgproxy CDN (Lidl page images) bot-
// blocks the obvious "GrocereeBot" UA — it serves a browser-looking request but
// drops ours. Other stores tolerate either; this keeps them all working.
const UA = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9,pt;q=0.8,cs;q=0.7",
};
export const VISION_MAX_PAGES = 10; // grocery deals are front-loaded; cap cost, latency + Worker CPU
const BATCH = 5;                    // page images per Gemini vision call

export function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// Fetch an explicit list of page-image URLs (e.g. from a manifest). The Schwarz
// imgproxy CDN resets bursts of rapid requests (most fail as connection errors),
// so fetch with a couple of retries and a small gap between pages rather than
// hammering it. Skips any URL that genuinely doesn't return an image.
export async function mediaFromUrls(urls: string[]): Promise<{ mime: string; data: string }[]> {
  const out: { mime: string; data: string }[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (const u of urls) {
    let got = false;
    for (let attempt = 0; attempt < 3 && !got; attempt++) {
      if (attempt) await sleep(250 * attempt);
      try {
        const res = await fetch(u, { headers: UA });
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (res.ok && ct.startsWith("image/")) {
          out.push({ mime: ct.split(";")[0], data: b64(await res.arrayBuffer()) });
          got = true;
        }
      } catch { /* retry */ }
    }
    await sleep(80); // gentle spacing so the CDN doesn't throttle the burst
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
  let ok = 0; let lastErr = "";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < media.length; i += BATCH) {
    if (i > 0) await sleep(1200); // throttle: stay well under free-tier ~15 req/min
    let parsed: ParsedFlyer;
    try { parsed = await geminiParse(geminiKey, media.slice(i, i + BATCH)); ok++; }
    catch (e: any) { lastErr = e?.message || String(e); continue; }
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
  // If every Gemini batch failed, surface why (rate limit, model error) instead
  // of a silent "0 items" — otherwise the real cause is invisible to the caller.
  if (ok === 0 && media.length && lastErr) throw new Error(`vision OCR failed: ${lastErr}`);

  return {
    store,
    valid_from: validFrom,
    valid_to: validTo,
    summary: summary || `${items.length} grocery deals from this week's flyer (${media.length} pages).`,
    items,
    page_count: media.length,
  };
}
