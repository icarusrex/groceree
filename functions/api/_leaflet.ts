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
//   https://www.lidl.pt/l/pt/folhetos/promocoes-a-partir-de-01-06/ar/0?lf=ABC
//   https://www.lidl.pt/c/folhetos/promocoes-a-partir-de-01-06/view/flyer/page/1
// In both shapes the segment after ".../folhetos/" is the identifier.
export function leafletSlug(viewerUrl: string): string | null {
  try {
    const segs = new URL(viewerUrl).pathname.split("/").filter(Boolean);
    const i = segs.lastIndexOf("folhetos");
    if (i >= 0 && segs[i + 1]) return segs[i + 1];
  } catch { /* fall through */ }
  return null;
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
  const urls = pages
    .map((p) => p?.image || p?.zoom || p?.thumbnail)
    .filter((u): u is string => typeof u === "string")
    .slice(0, VISION_MAX_PAGES);
  if (!urls.length) throw new Error("leaflet manifest listed no page images");

  const media = await mediaFromUrls(urls);
  if (!media.length) throw new Error("leaflet page images did not load");

  const validFrom = day(flyer?.offerStartDate || flyer?.startDate);
  const validTo = day(flyer?.offerEndDate || flyer?.endDate);
  return ocrPages(geminiKey, media, storeName, validFrom, validTo);
}
