import { json, type Env } from "./_helpers.ts";

// POST /api/generate-image { recipe_id, name, description }
// Uses Gemini image generation to make a dish photo, stores it on the recipe row.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not set" }, 500);
  const { recipe_id, name, description } = await ctx.request.json<any>();
  const prompt = `A appetising, well-lit overhead food photograph of "${name}". ${description || ""} Rustic home-cooked style, on a plate, natural light. No text, no people.`;

  const model = "gemini-3.1-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${ctx.env.GEMINI_API_KEY}`;
  const gres = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });
  if (!gres.ok) return json({ error: "image gen failed", detail: await gres.text() }, 502);
  const data = await gres.json<any>();
  // find inline image data in the response parts
  let b64 = "", mime = "image/png";
  for (const p of data.candidates?.[0]?.content?.parts || []) {
    if (p.inlineData || p.inline_data) {
      const d = p.inlineData || p.inline_data;
      b64 = d.data; mime = d.mimeType || d.mime_type || mime; break;
    }
  }
  if (!b64) return json({ error: "no image returned" }, 502);
  const dataUrl = `data:${mime};base64,${b64}`;
  if (recipe_id) {
    await ctx.env.DB.prepare("UPDATE recipes SET image_url=? WHERE id=?")
      .bind(dataUrl, recipe_id).run();
  }
  return json({ image_url: dataUrl });
};
