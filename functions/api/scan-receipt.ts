import { json, uid, userCountry, type Env } from "./_helpers.ts";
import { storeIdOf } from "./_flyer.ts";
import { geminiUrl, MIN_THINKING } from "./_gemini.ts";

// POST /api/scan-receipt  { images: [{mime, data(base64)}] }
// Photo of a grocery till receipt -> Gemini vision -> store, date, and the real
// price-paid line items -> persisted into store_prices as an honest, non-
// promotional price point. Unlike flyer prices (self-reported, promo-only), a
// receipt price is what actually left your pocket — same idea as the manual
// staple basket, just captured automatically instead of typed in by hand.
const PROMPT = `You are reading a supermarket receipt from Portugal or the Czech
Republic (a photo of a printed till receipt). Extract:
- the store name if printed - use the canonical chain name (e.g. "Continente",
  "Pingo Doce", "Lidl", "Aldi", "Intermarche", "Auchan", "Billa", "Albert", "Tesco"),
  not the branch address or a store code.
- the purchase date, if printed, as YYYY-MM-DD.
- every purchased GROCERY line item: a plain English name, and the price actually
  paid for that line (after any in-store discount already applied on the receipt -
  this is what was paid, not a shelf/before-discount price).
Ignore non-food lines: carrier bags, bottle/can deposits and refunds, loyalty-card
notes, and the subtotal/tax/total/payment/change lines at the bottom.
Return ONLY JSON, no prose, shaped:
{"store": "<name|null>", "date": "YYYY-MM-DD|null",
 "items": [{"name": "<english grocery name>", "name_pt": "<original receipt text>",
            "price": <number>, "unit": "<e.g. kg|un|null>"}]}`;

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const body = await ctx.request.json<any>().catch(() => ({}));
  const images = body.images || [];
  if (!images.length) return json({ error: "no images" }, 400);

  const parts: any[] = [{ text: PROMPT }];
  for (const im of images) parts.push({ inline_data: { mime_type: im.mime || "image/jpeg", data: im.data } });

  const url = geminiUrl(ctx.env.GEMINI_API_KEY);
  const gres = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.1, response_mime_type: "application/json",
        ...MIN_THINKING,
      },
    }),
  });
  if (!gres.ok) return json({ error: "gemini failed", detail: await gres.text() }, 502);
  const data = await gres.json<any>();
  let parsed: any;
  try {
    const txt = data.candidates[0].content.parts[0].text.replace(/^```(json)?|```$/gm, "").trim();
    parsed = JSON.parse(txt);
  } catch {
    return json({ error: "could not parse gemini output" }, 502);
  }

  const items = (parsed.items || []).filter((it: any) => it?.name && typeof it.price === "number");
  if (!items.length) {
    return json({ error: "No grocery items found on this receipt", store: parsed.store ?? null }, 502);
  }

  const user = uid(ctx);
  const country = await userCountry(ctx.env.DB, user);
  const storeName = parsed.store || "Unknown store";
  const storeId = storeIdOf(storeName);
  const date = parsed.date || new Date().toISOString().slice(0, 10);
  // Namespaced per scan (not per store/day like flyers): receipts accumulate,
  // they don't replace each other. Two trips to the same store on the same day
  // are two separate price points, not a correction of one another.
  const source = `receipt:${country}:${storeId}:${date}:${crypto.randomUUID().slice(0, 8)}`;

  const stmts: D1PreparedStatement[] = [
    ctx.env.DB.prepare("INSERT OR IGNORE INTO stores (id,name) VALUES (?,?)").bind(storeId, storeName),
    ...items.map((it: any) =>
      ctx.env.DB.prepare(
        `INSERT INTO store_prices (store_id,country,item_name,item_name_pt,unit,price,
          normal_price,discount,valid_from,valid_to,source) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(storeId, country, it.name, it.name_pt ?? null, it.unit ?? null, it.price,
             it.price, 0, date, date, source)),
  ];
  await ctx.env.DB.batch(stmts);

  return json({ store: storeName, date, item_count: items.length, items });
};
