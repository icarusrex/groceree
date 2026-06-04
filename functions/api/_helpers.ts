// Shared helpers for Pages Functions. Underscore prefix = not routed.
export interface Env { DB: D1Database; GEMINI_API_KEY: string; FIRECRAWL_API_KEY: string; }

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json" },
  });

// Per-user id from Cloudflare Access; falls back to 'me' for local dev.
export const uid = (ctx: { request: Request }) =>
  ctx.request.headers.get("Cf-Access-Authenticated-User-Email") || "me";

export async function ensureSettings(db: D1Database, user: string) {
  const row = await db.prepare("SELECT * FROM user_settings WHERE user_id=?")
    .bind(user).first();
  if (row) return row;
  await db.prepare("INSERT INTO user_settings (user_id) VALUES (?)").bind(user).run();
  return db.prepare("SELECT * FROM user_settings WHERE user_id=?").bind(user).first();
}
