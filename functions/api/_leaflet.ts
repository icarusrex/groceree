// Vision extraction for the Schwarz leaflet platform (Lidl). Each page image is
// individually HMAC-signed, so the page list is NOT derivable by swapping a
// number (unlike the iPaper-image stores). But the platform exposes an
// unauthenticated manifest API that lists every page's directly-fetchable image
// URL plus the flyer's validity dates. We read the manifest, then OCR the pages
// with the shared vision helpers.
import { type ParsedFlyer } from "./_flyer.ts";
import { mediaFromUrls, ocrPages, VISION_MAX_PAGES } from "./_vision.ts";

const MANIFEST = "https://endpoints.leaflets.schwarz/v4/flyer";

// The flyer "identifier" is the slug in the viewer URL, e.g.
//   PT: https://www.lidl.pt/l/pt/folhetos/promocoes-a-partir-de-01-06/ar/0?lf=ABC
//   CZ: https://www.lidl.cz/l/cs/letak/akcni-letak-od-pondeli-8-6-10-6-2026
// It's the segment right after the country-specific flyer marker.
export function leafletSlug(viewerUrl: string): string | null {
  try {
    const segs = new URL(viewerUrl).pathname.split("/").filter(Boolean);
    for (const marker of ["folhetos", "letak", "letaky"]) {
      const i = segs.lastIndexOf(marker);
      if (i >= 0 && segs[i + 1]) return segs[i + 1];
    }
    const last = segs[segs.length - 1]; // fallback: a trailing date-bearing slug
    return last && /\d/.test(last) ? last : null;
  } catch { return null; }
}

const day = (s?: string | null) => (s ? s.slice(0, 10) : null);

export async function extractLeafletFlyer(
  geminiKey: string, viewerUrl: string, storeName: string,
): Promise<ParsedFlyer> {
  const slug = leafletSlug(viewerUrl);
  if (!slug) throw new Error("could not parse leaflet identifier from viewer URL");

  const url = `${MANIFEST}?flyer_identifier=${encodeURIComponent(slug)}&region_id=0&region_code=0`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`leaflet manifest ${res.status}`);
  const data = await res.json<any>();
  const flyer = data?.flyer ?? data;

  const pages: any[] = flyer?.pages || [];
  const all = pages
    .map((p) => p?.image || p?.zoom || p?.thumbnail)
    .filter((u): u is string => typeof u === "string");
  if (!all.length) throw new Error("leaflet manifest listed no page images");
  // Big leaflets (Lidl runs 50+ pages, food often in the back half behind the
  // non-food range) — sample evenly across the whole flyer rather than just the
  // first N, so we don't miss the grocery section.
  const urls = all.length <= VISION_MAX_PAGES
    ? all
    : Array.from({ length: VISION_MAX_PAGES }, (_, i) => all[Math.floor(i * all.length / VISION_MAX_PAGES)]);

  const media = await mediaFromUrls(urls);
  if (!media.length) throw new Error("leaflet page images did not load");

  const validFrom = day(flyer?.offerStartDate || flyer?.startDate);
  const validTo = day(flyer?.offerEndDate || flyer?.endDate);
  return ocrPages(geminiKey, media, storeName, validFrom, validTo);
}
