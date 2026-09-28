import { json, type Env } from "./_helpers.ts";
import { geminiParse } from "./_flyer.ts";
import { mediaFromUrls } from "./_vision.ts";

// POST /api/ocr-page  { image_url } | { image: { mime, data(base64) } }
// Step 2 of the per-page flyer flow. Fetches ONE page image and OCRs it with
// Gemini vision, returning that page's items plus any store/date/summary the
// model read. One image per request keeps the Worker comfortably under the CPU
// limit (the base64 + request-build is the CPU cost; the Gemini call itself is
// idle wait). The browser loops the pages and merges/dedupes the results, then
// persists them via /api/save-flyer.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const body = await ctx.request.json<any>().catch(() => ({}));
  const imageUrl: string = body.image_url;
  const inline = body.image?.data ? [{ mime: body.image.mime || "image/jpeg", data: body.image.data }] : null;
  if (!imageUrl && !inline) return json({ error: "image_url or image required" }, 400);
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);

  // Uploaded pages arrive inline (the browser already rendered + downscaled them).
  // Otherwise mediaFromUrls uses a browser-looking UA + retries (the Schwarz/Lidl
  // CDN bot-blocks otherwise) and base64s the single image.
  const media = inline ?? await mediaFromUrls([imageUrl]);
  if (!media.length) return json({ items: [] }); // image didn't load — skip this page

  try {
    const parsed = await geminiParse(ctx.env.GEMINI_API_KEY, media);
    return json({
      store: parsed.store ?? null,
      valid_from: parsed.valid_from ?? null,
      valid_to: parsed.valid_to ?? null,
      summary: parsed.summary ?? null,
      items: parsed.items || [],
    });
  } catch (e: any) {
    return json({ error: `vision OCR failed: ${e.message}` }, 502);
  }
};
