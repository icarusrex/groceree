import { json, uid, userCountry, type Env } from "./_helpers.ts";
import { priceFromShelf, upsertStatements } from "./_pricebook.ts";

// POST /api/price-fill { items: string[] } (≤ 8 canonical ingredient names)
// Looks the batch up on Auchan's shop (2 Gemini calls + one search each) and
// stores the shelf prices. The browser calls this in the background for any
// ingredient the price book is missing, one batch per request (Worker CPU).
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const body = await ctx.request.json<any>().catch(() => ({}));
  const items: string[] = (Array.isArray(body.items) ? body.items : [])
    .filter((s: any) => typeof s === "string" && s.trim()).map((s: string) => s.trim().toLowerCase()).slice(0, 8);
  if (!items.length) return json({ error: "items required" }, 400);
  const country = await userCountry(ctx.env.DB, uid(ctx));
  if (country !== "PT") return json({ priced: [] }); // Auchan PT is the only shelf source so far
  try {
    const priced = await priceFromShelf(ctx.env.GEMINI_API_KEY, items);
    await ctx.env.DB.batch(upsertStatements(ctx.env.DB, country, "shelf", priced, "Auchan"));
    return json({ priced });
  } catch (e: any) {
    return json({ error: `price lookup failed: ${e.message}` }, 502);
  }
};
