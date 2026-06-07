import { json, uid, userCountry, type Env } from "./_helpers.ts";
import { geminiParse, persistFlyer } from "./_flyer.ts";

// POST /api/parse-flyer  { images: [{mime, data(base64)}], store_hint? }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const body = await ctx.request.json<any>();
  const images = body.images || [];
  if (!images.length) return json({ error: "no images" }, 400);

  let parsed;
  try {
    parsed = await geminiParse(ctx.env.GEMINI_API_KEY, images);
  } catch (e: any) {
    return json({ error: "gemini failed", detail: e.message }, 502);
  }

  const storeName = parsed.store || body.store_hint || "unknown";
  const user = uid(ctx);
  const country = await userCountry(ctx.env.DB, user);
  const deals = await persistFlyer(ctx.env.DB, user, country, { ...parsed, store: storeName });

  return json({ store: storeName, valid_from: parsed.valid_from,
                valid_to: parsed.valid_to, summary: parsed.summary,
                items: parsed.items, deals });
};
