import { json, uid, type Env } from "./_helpers.ts";

// The cost guardrail, in words — mirrors src/data/cost_tiers.ts COST_INSTRUCTIONS.
const COST_RULE = `Cheap staples (chicken thighs, mince, eggs, beans, lentils,
potatoes, onions, carrots, cabbage, frozen veg, tinned tomatoes, seasonal produce)
are good value. Premium items (lobster, prawns, scallops, fresh tuna/sea bass,
steak, lamb, duck, pine nuts, saffron, aged cheese) are NOT good value just because
discounted — a small discount on an expensive item is still expensive. Only treat a
premium item as a deal if the discount is 40%+.`;

const PROMPT = `You are reading a supermarket flyer image (Portugal). Extract the
discounted grocery items. ${COST_RULE}
Return ONLY JSON, no prose, shaped:
{"store": "<name>", "valid_from": "YYYY-MM-DD|null", "valid_to": "YYYY-MM-DD|null",
 "items": [{"name": "<english grocery name>", "name_pt": "<portuguese>",
            "price": <number>, "normal_price": <number|null>, "unit": "<e.g. kg|un>",
            "discount": <0..1>, "good_value": <true|false>}]}
Set good_value=false for premium items with shallow discounts per the rule above.`;

// POST /api/parse-flyer  { images: [{mime, data(base64)}], store_hint? }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const body = await ctx.request.json<any>();
  const images = body.images || [];
  if (!images.length) return json({ error: "no images" }, 400);

  const parts: any[] = [{ text: PROMPT }];
  for (const im of images) {
    parts.push({ inline_data: { mime_type: im.mime || "image/jpeg", data: im.data } });
  }
  const model = "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ctx.env.GEMINI_API_KEY}`;
  const gres = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.1, response_mime_type: "application/json" },
    }),
  });
  if (!gres.ok) return json({ error: "gemini failed", detail: await gres.text() }, 502);
  const data = await gres.json<any>();
  let parsed: any;
  try {
    const txt = data.candidates[0].content.parts[0].text.replace(/^```(json)?|```$/gm, "").trim();
    parsed = JSON.parse(txt);
  } catch (e) {
    return json({ error: "could not parse gemini output" }, 502);
  }

  // Persist price history (builds trends over time) and build the deals map.
  const user = uid(ctx);
  const storeName = parsed.store || body.store_hint || "unknown";
  const storeId = storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  await ctx.env.DB.prepare("INSERT OR IGNORE INTO stores (id,name) VALUES (?,?)")
    .bind(storeId, storeName).run();
  const source = `flyer:${storeId}:${parsed.valid_from || new Date().toISOString().slice(0, 10)}`;
  const deals: Record<string, number> = {};
  for (const it of parsed.items || []) {
    await ctx.env.DB.prepare(
      `INSERT INTO store_prices (store_id,item_name,item_name_pt,unit,price,normal_price,
        discount,valid_from,valid_to,source) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).bind(storeId, it.name, it.name_pt ?? null, it.unit ?? null, it.price ?? null,
           it.normal_price ?? null, it.discount ?? null,
           parsed.valid_from ?? null, parsed.valid_to ?? null, source).run();
    // only genuinely good-value discounts feed the planner
    if (it.good_value && it.discount) deals[it.name.toLowerCase()] = it.discount;
  }
  return json({ store: storeName, valid_from: parsed.valid_from,
                valid_to: parsed.valid_to, items: parsed.items, deals });
};
