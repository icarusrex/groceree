import { json, uid, type Env } from "./_helpers.ts";
import { geminiParse, persistFlyer, summariseFlyer, type ParsedFlyer } from "./_flyer.ts";
import { extractIpaper, looksLikeIpaper } from "./_ipaper.ts";
import { sourceById } from "./_sources.ts";

// POST /api/fetch-flyer { store_id?, store_name?, flyer_url, valid_from?, valid_to? }
// Downloads a chosen flyer and parses it into price rows — no manual upload.
//  - iPaper viewers: pull the structured price feed (exact, free, no AI).
//  - direct PDF/image URLs: download bytes and parse with Gemini vision.

const UA = { "user-agent": "Mozilla/5.0 (compatible; GrocereeBot/1.0)" };

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const body = await ctx.request.json<any>().catch(() => ({}));
  const flyerUrl: string = body.flyer_url;
  if (!flyerUrl) return json({ error: "flyer_url required" }, 400);

  const src = body.store_id ? sourceById(body.store_id) : undefined;
  const storeName = body.store_name || src?.name || "unknown";
  const user = uid(ctx);

  // Decide the extraction strategy.
  const res = await fetch(flyerUrl, { headers: UA });
  const ctype = (res.headers.get("content-type") || "").toLowerCase();

  // 1) iPaper structured feed (preferred).
  if (ctype.includes("text/html")) {
    const html = await res.text();
    if (src?.kind === "ipaper" || looksLikeIpaper(html)) {
      const { items, pageCount, validFrom, validTo } = await extractIpaper(flyerUrl);
      if (!items.length) {
        return json({ error: "iPaper feed found no priced products on this flyer" }, 502);
      }
      // AI theme hint ("Mexican week" / "great fish deals"); falls back to a
      // plain product-count line when there's no Gemini key or the call fails.
      const theme = await summariseFlyer(ctx.env.GEMINI_API_KEY, storeName, items);
      const parsed: ParsedFlyer = {
        store: storeName,
        valid_from: body.valid_from ?? validFrom,
        valid_to: body.valid_to ?? validTo,
        summary: theme || `${items.length} products from this week's flyer (${pageCount} pages).`,
        items,
      };
      const deals = await persistFlyer(ctx.env.DB, user, parsed);
      return json({ method: "ipaper", store: storeName, item_count: items.length,
                    page_count: pageCount, summary: parsed.summary, deals });
    }
    return json({ error: "This flyer isn't a structured viewer. Open it and upload the PDF/images instead." }, 422);
  }

  // 2) Direct PDF or image — Gemini vision parse.
  if (ctype.includes("application/pdf") || ctype.startsWith("image/")) {
    if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
    const data = b64(await res.arrayBuffer());
    const mime = ctype.includes("pdf") ? "application/pdf" : ctype.split(";")[0];
    let parsed;
    try {
      parsed = await geminiParse(ctx.env.GEMINI_API_KEY, [{ mime, data }]);
    } catch (e: any) {
      return json({ error: "gemini failed", detail: e.message }, 502);
    }
    parsed.store = parsed.store || storeName;
    const deals = await persistFlyer(ctx.env.DB, user, parsed);
    return json({ method: "gemini", store: parsed.store, item_count: (parsed.items || []).length,
                  summary: parsed.summary, deals });
  }

  return json({ error: `Unsupported flyer content-type: ${ctype || "unknown"}` }, 415);
};
