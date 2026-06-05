import { json, uid, type Env } from "./_helpers.ts";
import { crossStoreDeals, type DealRow } from "./_analysis.ts";

// POST /api/deal-plan { store_name?, days? }
// The "cook from this week's deals" mode: instead of matching deals to the recipe
// database, GENERATE a short dinner menu built around a shop's actual discounted,
// diet-friendly food (sugar/alcohol/non-food already excluded by crossStoreDeals).
// Returns full recipes the client can read and save into the recipe DB.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const body = await ctx.request.json<any>().catch(() => ({}));
  const user = uid(ctx);
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.min(7, Math.max(1, Number(body.days) || 4));

  // Newest non-expired flyer per store; narrow to the requested store if given.
  const { results } = await ctx.env.DB.prepare(
    "SELECT * FROM flyers WHERE user_id=? ORDER BY created_at DESC",
  ).bind(user).all();
  const byStore = new Map<string, any>();
  for (const f of results as any[]) {
    if (f.valid_to && f.valid_to < today) continue;
    if (!byStore.has(f.store_id)) byStore.set(f.store_id, f);
  }
  let flyers = [...byStore.values()];
  if (body.store_name) flyers = flyers.filter((f) => f.store_name === body.store_name);
  const flyer = flyers[0];
  if (!flyer) return json({ error: "No current flyer for that store." }, 404);

  // Diet + household size shape the menu.
  const st = await ctx.env.DB.prepare(
    "SELECT diet, household_size FROM user_settings WHERE user_id=?",
  ).bind(user).first<{ diet: string; household_size: number }>();
  let diet: string[] = [];
  try { diet = JSON.parse(st?.diet || "[]"); } catch { diet = []; }
  const people = Number(st?.household_size) || 2;

  // This store's discounted FOOD deals (empty index → ranked by cheapness; the
  // diet/sugar/alcohol/non-food filters still apply).
  const pr = await ctx.env.DB.prepare(
    `SELECT item_name, item_name_pt, unit, price, normal_price, discount
       FROM store_prices WHERE store_id=? AND IFNULL(valid_from,'')=IFNULL(?,'')`,
  ).bind(flyer.store_id, flyer.valid_from ?? null).all();
  const deals = crossStoreDeals(
    [{ store: flyer.store_name, rows: (pr.results as unknown as DealRow[]) || [] }],
    new Map(), diet, 30,
  );
  if (!deals.length) return json({ error: "No usable food deals at this store right now." }, 404);

  const dealList = deals
    .map((d) => `- ${d.name} (€${d.price}${d.discount ? `, -${Math.round(d.discount * 100)}%` : ""})`)
    .join("\n");
  const dietLine = diet.length
    ? `Hard dietary constraints: ${diet.map((x) => x.replace("_", " ")).join(", ")}. EVERY recipe must comply.`
    : "No dietary restrictions.";

  const PROMPT = `You are a thrifty home cook in Portugal. Design a ${days}-dinner menu for a
household of ${people}, built PRIMARILY around this week's on-sale ingredients at
${flyer.store_name}. Lean hard on the sale items; fill gaps only with cheap pantry
staples (oil, salt, pepper, garlic, onion, rice, pasta, flour, eggs, canned tomato,
stock). Keep it simple weeknight cooking, varied across the week. ${dietLine}

ON SALE THIS WEEK AT ${flyer.store_name}:
${dealList}

Return ONLY JSON, no prose:
{"recipes":[{
  "name":"", "description":"one short appetising line",
  "cuisine":"", "primary_protein":"chicken|beef|pork|fish|turkey|lamb|none",
  "total_time":<minutes>, "servings":${people},
  "is_gluten_free":<bool>,"is_vegetarian":<bool>,"is_pescatarian":<bool>,
  "is_dairy_free":<bool>,"contains_dairy":<bool>,
  "deal_used":["<exact sale item names this recipe uses>"],
  "ingredients":[{"name":"","quantity":<number|null>,"unit":"","category":"meat|seafood|dairy|produce|pantry|frozen"}],
  "instructions":["step","step"]
}]}
Exactly ${days} recipes. Each recipe's main ingredients should be mostly from the sale list.`;

  const model = "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ctx.env.GEMINI_API_KEY}`;
  const reqBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: PROMPT }] }],
    generationConfig: { temperature: 0.6, response_mime_type: "application/json" },
  });
  // The model is occasionally overloaded (503/429). Retry a few times with backoff
  // before giving up, and return a friendly message rather than a raw upstream error.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: reqBody });
    if (res.ok || (res.status !== 503 && res.status !== 429)) break;
    await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
  }
  if (!res || !res.ok) {
    const busy = res?.status === 503 || res?.status === 429;
    return json({
      error: busy ? "The recipe model is busy right now — give it a few seconds and try again." : "Menu generation failed.",
      detail: res ? await res.text() : "no response",
    }, 502);
  }
  const data = await res.json<any>();
  let parsed: any;
  try {
    const txt = data.candidates[0].content.parts[0].text.replace(/^```(json)?|```$/gm, "").trim();
    parsed = JSON.parse(txt);
  } catch {
    return json({ error: "could not parse generated menu" }, 502);
  }
  return json({ store: flyer.store_name, days, recipes: (parsed.recipes || []).slice(0, days) });
};
