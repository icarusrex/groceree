import { json, uid, userCountry, type Env } from "./_helpers.ts";
import { persistFlyer, type ParsedFlyer } from "./_flyer.ts";
import { sourceById } from "./_sources.ts";

// POST /api/save-flyer
//   { store_id?, store_name, valid_from?, valid_to?, summary?, items[], page_count? }
// Step 3 of the per-page flyer flow. Persists the browser-merged OCR results to
// D1. Items are plain text (a few KB), and persistFlyer batches the writes into
// one D1 call, so this stays well under the CPU + subrequest limits even for a
// big flyer.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const body = await ctx.request.json<any>().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return json({ error: "No grocery deals found on this flyer" }, 502);

  const src = body.store_id ? sourceById(body.store_id) : undefined;
  // Always persist under the canonical store name (the model may write "ALDI" vs
  // "Aldi", which would fork the store id and split its prices).
  const storeName = src?.name || body.store_name || "unknown";
  const user = uid(ctx);
  // A known store carries its own country (lidl-cz is Czech no matter who fetches
  // it); an unknown/generic flyer falls back to the fetching user's country.
  const country = src?.country ?? await userCountry(ctx.env.DB, user);

  const parsed: ParsedFlyer = {
    store: storeName,
    valid_from: body.valid_from ?? null,
    valid_to: body.valid_to ?? null,
    summary: body.summary ?? null,
    items,
    page_count: body.page_count,
  };
  const deals = await persistFlyer(ctx.env.DB, user, country, parsed);
  return json({ store: storeName, item_count: items.length, page_count: body.page_count,
                summary: parsed.summary, deals });
};
