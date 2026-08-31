import { json, uid, userCountry, type Env } from "./_helpers.ts";

// POST /api/compare-stores
//   body: { plan?: [{name, cuisine, primary_protein}], week_start?: string }
// Compares the user's current (non-expired) store flyers and returns a structured
// recommendation: which store is best THIS WEEK, why (cost + any theme like "Mexican
// week"), and what each store is best for. Uses the same cheap-vs-premium guardrail as
// the flyer parser so a discounted-but-still-expensive item never wins the week.

const COST_RULE = `Cheap staples (chicken thighs, mince, eggs, beans, lentils, potatoes,
onions, carrots, cabbage, frozen veg, tinned tomatoes, in-season produce) drive real
savings. Premium items (lobster, prawns, scallops, fresh tuna/sea bass, steak, lamb,
duck, pine nuts, saffron, aged cheese) are NOT a win just because discounted. Judge a
store on the value of its CHEAP-STAPLE deals and how well they fit the planned meals.`;

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const body = await ctx.request.json<any>().catch(() => ({}));
  const user = uid(ctx);
  const country = await userCountry(ctx.env.DB, user);
  const today = new Date().toISOString().slice(0, 10);

  // newest non-expired flyer per store
  const { results } = await ctx.env.DB.prepare(
    "SELECT * FROM flyers WHERE country=? ORDER BY created_at DESC",
  ).bind(country).all();
  const byStore = new Map<string, any>();
  for (const f of results as any[]) {
    if (f.valid_to && f.valid_to < today) continue;        // skip expired
    if (!byStore.has(f.store_id)) byStore.set(f.store_id, f); // keep newest only
  }
  const flyers = [...byStore.values()];
  if (flyers.length < 2) {
    return json({ insufficient: true, store_count: flyers.length,
      message: "Upload flyers from at least two stores (both still valid) to compare." });
  }

  // gather each store's good-value deals + a sample of cheap items
  const stores: any[] = [];
  for (const f of flyers) {
    const { results: items } = await ctx.env.DB.prepare(
      `SELECT item_name, price, normal_price, discount, unit FROM store_prices
       WHERE store_id=? AND country=? AND (valid_to IS NULL OR valid_to >= ?)
       ORDER BY discount DESC LIMIT 30`,
    ).bind(f.store_id, country, today).all();
    stores.push({
      store: f.store_name,
      valid_from: f.valid_from, valid_to: f.valid_to,
      summary: f.summary,
      deals: Object.keys(JSON.parse(f.deals || "{}")),
      items: (items as any[]).map((i) => ({
        name: i.item_name, price: i.price, was: i.normal_price,
        discount: i.discount, unit: i.unit,
      })),
    });
  }

  const planned = (body.plan || []).slice(0, 14);
  const planLine = planned.length
    ? `The user's planned meals this week: ${planned.map((p: any) =>
        `${p.name}${p.cuisine ? ` (${p.cuisine})` : ""}`).join("; ")}.`
    : "The user has not built a plan yet — judge stores on general value for a busy family in Portugal.";

  const PROMPT = `You help a busy family in Portugal decide where to shop THIS WEEK.
${COST_RULE}
${planLine}
Here are the candidate stores with their current flyer deals:
${JSON.stringify(stores, null, 0)}

Pick the single best store for the week and explain plainly. Consider value of cheap
staples first, then how well the deals fit the planned meals, then any fun theme (e.g.
"lots of peppers, avocado and lime — lean into a Mexican night"). Be concrete and warm,
no fluff. Return ONLY JSON, no prose, shaped:
{"winner":"<store name>",
 "reason":"<2-3 sentences: why this store wins this week>",
 "theme":"<short cuisine/vibe idea grounded in the deals, or null>",
 "suggested_cuisine":"<one cuisine to lean into, or null>",
 "stores":[{"store":"<name>","best_for":["<cheap item or category>","..."],
            "verdict":"<one short line>"}]}`;

  const model = "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ctx.env.GEMINI_API_KEY}`;
  const gres = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: PROMPT }] }],
      generationConfig: { temperature: 0.4, response_mime_type: "application/json" },
    }),
  });
  if (!gres.ok) return json({ error: "gemini failed", detail: await gres.text() }, 502);
  const data = await gres.json<any>();
  try {
    const txt = data.candidates[0].content.parts[0].text.replace(/^```(json)?|```$/gm, "").trim();
    const parsed = JSON.parse(txt);
    return json({ ...parsed, store_count: stores.length });
  } catch {
    return json({ error: "could not parse gemini output" }, 502);
  }
};
