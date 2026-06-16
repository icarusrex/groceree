import { json, type Env } from "./_helpers.ts";
import { sourceById } from "./_sources.ts";
import { listImageFlyerPages } from "./_imageflyer.ts";
import { listLeafletPages } from "./_leaflet.ts";

// POST /api/flyer-pages  { store_id?, flyer_url }
// Step 1 of the per-page flyer flow. Returns the list of page-image URLs for an
// image-OCR flyer (Normal res) plus its validity dates. NO OCR, NO base64 — this
// stays cheap on CPU. The browser then calls /api/ocr-page once per page (each
// call stays under the Worker CPU limit) and finally /api/save-flyer with the
// merged items. Splitting the work this way is what lets a 10-page flyer parse on
// the free Workers plan, where one all-at-once request blows the CPU limit.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const body = await ctx.request.json<any>().catch(() => ({}));
  const flyerUrl: string = body.flyer_url;
  if (!flyerUrl) return json({ error: "flyer_url required" }, 400);
  const src = body.store_id ? sourceById(body.store_id) : undefined;

  try {
    if (src?.kind === "ipaper-image") {
      if (!ctx.env.FIRECRAWL_API_KEY) return json({ error: "FIRECRAWL_API_KEY not set" }, 500);
      return json(await listImageFlyerPages(ctx.env.FIRECRAWL_API_KEY, flyerUrl));
    }
    if (src?.kind === "leaflet") {
      return json(await listLeafletPages(flyerUrl));
    }
  } catch (e: any) {
    return json({ error: `could not list flyer pages: ${e.message}` }, 502);
  }
  return json({ error: "this flyer is not an image-OCR source" }, 422);
};
