import { json, uid, type Env } from "./_helpers.ts";

// POST /api/scan-pantry  { images: [{mime, data(base64)}] }
// Identifies food items in a fridge/pantry/grocery photo and stores them as pantry rows.
const PROMPT = `You are looking at a photo of a fridge, pantry shelf, or groceries (Portugal).
List the distinct FOOD items you can identify, each with an estimated quantity if visible.
Ignore non-food clutter. Return ONLY JSON, no prose, shaped:
{"items":[{"name":"<english grocery name, e.g. 'chicken breast', 'yellow onion'>",
           "qty":<number|null>,"unit":"<e.g. kg|g|un|null>"}]}`;

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const body = await ctx.request.json<any>();
  const images = body.images || [];
  if (!images.length) return json({ error: "no images" }, 400);

  const parts: any[] = [{ text: PROMPT }];
  for (const im of images) {
    parts.push({ inline_data: { mime_type: im.mime || "image/jpeg", data: im.data } });
  }
  const model = "gemini-2.5-flash";
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
  } catch {
    return json({ error: "could not parse gemini output" }, 502);
  }

  // persist each detected item to the pantry
  const user = uid(ctx);
  const added: string[] = [];
  for (const it of parsed.items || []) {
    if (!it.name) continue;
    const raw = `${it.qty ? it.qty + (it.unit ? it.unit : "") + " " : ""}${it.name}`.trim();
    await ctx.env.DB.prepare(
      "INSERT INTO pantry_items (user_id, raw_text, name, unit, source) VALUES (?,?,?,?,?)",
    ).bind(user, raw, it.name, it.unit ?? null, "photo").run();
    added.push(raw);
  }
  return json({ added, count: added.length });
};
