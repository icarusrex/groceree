import { json, type Env } from "./_helpers.ts";
import { readSfccChunk } from "./_sfcc.ts";

// POST /api/grid-page  { url }
// Structured counterpart of /api/ocr-page: reads ONE chunk of a shop-grid flyer
// (Auchan) and returns its grocery items with exact prices. The browser loops
// the chunks from /api/flyer-pages, merges, then calls /api/save-flyer.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const body = await ctx.request.json<any>().catch(() => ({}));
  if (!body.url) return json({ error: "url required" }, 400);
  try {
    return json({ items: await readSfccChunk(body.url, ctx.env.GEMINI_API_KEY) });
  } catch (e: any) {
    return json({ error: `grid read failed: ${e.message}` }, 502);
  }
};
