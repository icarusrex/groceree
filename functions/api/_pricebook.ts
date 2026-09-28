// Price book: one live unit price per canonical ingredient (the names the
// shopping list uses — "chicken breast", "onion"), so a recipe costs out by
// arithmetic. Baseline = Auchan's online shop, which prints a unit price
// (€/Kg, €/Lt) on every tile; receipts override it with what was really paid.
//
// Filling a batch of ingredients:
//   1. Gemini turns the English names into Portuguese shop searches (one call)
//   2. one Auchan search per ingredient; unit prices parsed from the tiles
//   3. Gemini picks which results ARE that ingredient, plain and everyday — the
//      cheapest €/kg for "chicken breast" is nuggets, which it must skip (one call)
//   4. median €/kg of the picked products → price_book
import { geminiUrl, MIN_THINKING } from "./_gemini.ts";
import { BROWSER, unescape } from "./_sfcc.ts";

const SEARCH = "https://www.auchan.pt/on/demandware.store/Sites-AuchanPT-Site/pt_PT/Search-UpdateGrid";
export const SHELF_TTL_DAYS = 30;     // refresh shelf prices monthly
export const RECEIPT_TTL_DAYS = 90;   // a paid price beats the shelf for 3 months

interface Candidate { name: string; per_kg: number | null; per_item: number | null }

const num = (s: string) => Number(s.replace(",", "."));
const text = (tile: string, cls: string) => {
  const m = new RegExp(`class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)</(?:span|div)>`).exec(tile);
  return m ? unescape(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() : "";
};

// One tile → unit prices. Auchan prints:
//   "5.72 €/Lt" · "2.38 €/Kg"                  → per kg (litre ≈ kg for costing)
//   "8.44 €/un" + "Quant. Mínima = 1.3Kg (1 un)" → weighed piece → per kg + per item
//   "1.57 €"    + "Quant. Mínima = 250g"         → price per minimum step → per kg
//   "0.35 €/un"                                  → per item
// The unit price reflects any promo; scale back to the regular price with the
// tile's original/discount data, so the baseline isn't a one-week deal.
function candidate(tile: string): Candidate | null {
  const gtm = /data-gtm-new="([^"]+)"/.exec(tile);
  if (!gtm) return null;
  let g: any;
  try { g = JSON.parse(unescape(gtm[1])); } catch { return null; }
  const regular = Number(g.price), off = Number(g.discount) || 0;
  const promo = regular > 0 && off > 0 && off < regular ? regular / (regular - off) : 1;
  const ppu = text(tile, "auc-measures--price-per-unit");
  const avg = text(tile, "auc-measures--avg-weight");
  const val = /([\d.,]+)\s*€/.exec(ppu);
  if (!val) return null;
  const v = num(val[1]) * promo;
  const minQty = /=\s*([\d.,]+)\s*(kg|g)\b/i.exec(avg);
  const minKg = minQty ? num(minQty[1]) / (minQty[2].toLowerCase() === "kg" ? 1 : 1000) : null;
  let per_kg: number | null = null, per_item: number | null = null;
  if (/€\s*\/\s*(kg|lt|l)\b/i.test(ppu)) per_kg = v;
  // "€/un" with a minimum weight is a price per weighed step (250 g of onions),
  // not per piece — only a bare "€/un" is a real per-item price.
  else if (/€\s*\/\s*un/i.test(ppu)) { if (minKg) per_kg = v / minKg; else per_item = v; }
  else if (minKg) per_kg = v / minKg;
  else per_item = v;
  const r = (x: number | null) => (x == null || !isFinite(x) ? null : Math.round(x * 100) / 100);
  return { name: String(g.item_name).trim(), per_kg: r(per_kg), per_item: r(per_item) };
}

export async function search(query: string): Promise<Candidate[]> {
  const res = await fetch(`${SEARCH}?q=${encodeURIComponent(query)}&start=0&sz=12`, { headers: BROWSER });
  if (!res.ok) return [];
  const html = await res.text();
  return html.split('class="product-tile ').slice(1).map(candidate).filter((c): c is Candidate => !!c);
}

async function gemini(apiKey: string, prompt: string): Promise<any> {
  const res = await fetch(geminiUrl(apiKey), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, response_mime_type: "application/json", ...MIN_THINKING },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json<any>();
  return JSON.parse(data.candidates[0].content.parts[0].text.replace(/^```(json)?|```$/gm, "").trim());
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null;
};

export interface Priced { item: string; per_kg: number | null; per_item: number | null; product: string | null }

// Price a batch (≤ 8) of canonical ingredients from Auchan's shop.
export async function priceFromShelf(apiKey: string, items: string[]): Promise<Priced[]> {
  const q = await gemini(apiKey, `For each grocery ingredient, give the Portuguese search term a shopper
would type on a Portuguese supermarket website to find it in its plain, everyday form
("chicken breast" → "peito de frango", "tinned tomatoes" → "tomate pelado lata",
"spring onion" → "cebolinho"). Return ONLY JSON: {"queries":["..."]} in the same order.
${JSON.stringify(items)}`);
  const queries: string[] = Array.isArray(q.queries) && q.queries.length === items.length ? q.queries : items;
  const results = await Promise.all(queries.map((s) => search(s).catch(() => [] as Candidate[])));

  const pick = await gemini(apiKey, `A home cook needs to buy each ingredient below for a recipe. For each one,
you get numbered supermarket search results. List the numbers of the results that ARE that
ingredient in its plain, everyday form: the thing itself, any ordinary size or brand. Exclude
processed or different products (nuggets, ham, ready meals, snacks, sauces, baby food,
seasoned/breaded versions), and premium variants (organic, free-range, gourmet) unless nothing
else matches. An empty list is fine when nothing matches.
Return ONLY JSON: {"matches":[[...numbers for item 1], [...for item 2], ...]}
${JSON.stringify(items.map((item, i) => ({ item, results: results[i].map((c, n) => `${n}: ${c.name}`) })))}`);
  const matches: number[][] = Array.isArray(pick.matches) ? pick.matches : [];

  return items.map((item, i) => {
    const chosen = (matches[i] || []).map((n) => results[i][n]).filter(Boolean);
    const kg = median(chosen.map((c) => c.per_kg).filter((x): x is number => x != null));
    const each = median(chosen.map((c) => c.per_item).filter((x): x is number => x != null));
    return {
      item,
      per_kg: kg == null ? null : Math.round(kg * 100) / 100,
      per_item: each == null ? null : Math.round(each * 100) / 100,
      product: chosen[0]?.name ?? null,
    };
  });
}

// Upsert rows; a null-priced shelf row records "not found" (no retry until stale).
// `at` is when the price was true — a receipt's purchase date, so a months-old
// receipt scanned today neither looks fresh nor overwrites a newer price.
export function upsertStatements(db: D1Database, country: string, source: "shelf" | "receipt",
                                 rows: Priced[], store: string | null, at?: string) {
  return rows.map((r) => db.prepare(
    `INSERT INTO price_book (country,item,source,per_kg,per_item,store,product,updated_at)
     VALUES (?,?,?,?,?,?,?,COALESCE(?, datetime('now')))
     ON CONFLICT(country,item,source) DO UPDATE SET per_kg=excluded.per_kg, per_item=excluded.per_item,
       store=excluded.store, product=excluded.product, updated_at=excluded.updated_at
     WHERE excluded.updated_at >= price_book.updated_at`,
  ).bind(country, r.item, source, r.per_kg, r.per_item, store, r.product, at ?? null));
}
