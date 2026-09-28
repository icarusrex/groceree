// Auchan PT's weekly flyer is also a product-listing category on its Salesforce
// Commerce Cloud (SFCC) shop: /pt/folheto-semanal-<week>-<n>/. Every tile carries
// GA4 data (data-gtm-new) with name, category, the ORIGINAL price and the discount
// amount — exact prices, no OCR. ~580 products, 60% non-food, and one 600-item
// grid page is ~8 MB of HTML (too much for one Worker's CPU budget), so the
// browser reads it in chunks: flyer-pages lists chunk URLs, /api/grid-page reads
// one chunk each, save-flyer persists the merged items.
import { geminiUrl, MIN_THINKING } from "./_gemini.ts";
import type { FlyerItem } from "./_flyer.ts";

const ORIGIN = "https://www.auchan.pt";
const GRID = `${ORIGIN}/on/demandware.store/Sites-AuchanPT-Site/pt_PT/Search-UpdateGrid`;
const CHUNK = 48;
// Auchan's own top-level categories that are groceries. Drinks are left out, as
// they are everywhere else in the app (they skewed recipe matching and deals).
const FOOD = new Set(["Alimentação", "Produtos Frescos", "Congelados", "Biológicos e Alternativas"]);
// Premium items are only a deal at a steep discount (mirrors the OCR prompt's rule).
const PREMIUM = /lagosta|camar[aã]o|gamba|vieira|atum fresco|robalo|bife|novilho|borrego|pato|pinh[oõ]|a[cç]afr[aã]o|curad|presunto|salm[aã]o fumado/i;

export const BROWSER = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
  "accept-language": "pt-PT,pt;q=0.9",
};

// SFCC writes accents as named entities ("Alimenta&ccedil;&atilde;o", "CAMAR&Atilde;O").
// Decode letter+accent entities by composing the base letter with the combining
// mark, plus numeric and the few structural ones.
const MARKS: Record<string, string> = { acute: "\u0301", grave: "\u0300", circ: "\u0302", tilde: "\u0303", uml: "\u0308", cedil: "\u0327", ring: "\u030A" };
const unescape = (s: string) => s
  .replace(/&([A-Za-z])(acute|grave|circ|tilde|uml|cedil|ring);/g, (_, c, m) => c + MARKS[m])
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .normalize("NFC");

// "HIPERS FOLHETO SEMANAL 39 24-09 A 30-09" → ISO dates (year from today, rolled
// across New Year when the range wraps).
function titleDates(title: string): { from: string | null; to: string | null } {
  const m = /(\d{1,2})-(\d{1,2})\s*A\s*(\d{1,2})-(\d{1,2})/i.exec(title);
  if (!m) return { from: null, to: null };
  const [d1, m1, d2, m2] = m.slice(1).map(Number);
  const now = new Date();
  let y1 = now.getUTCFullYear();
  if (m1 === 12 && now.getUTCMonth() === 0) y1--;          // Dec flyer read in January
  const y2 = m2 < m1 ? y1 + 1 : y1;
  const iso = (y: number, mo: number, d: number) => `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { from: iso(y1, m1, d1), to: iso(y2, m2, d2) };
}

// Weekly flyer page → its catalogue id, dates and the chunked grid URLs.
export async function listSfccChunks(viewerUrl: string) {
  const res = await fetch(viewerUrl, { headers: BROWSER });
  if (!res.ok) throw new Error(`auchan flyer page ${res.status}`);
  const html = await res.text();
  const cgid = /cgid=([A-Z0-9]+)/.exec(html)?.[1];
  if (!cgid) throw new Error("no catalogue id on the flyer page");
  const total = Number(/([\d.]+)\s*resultados/.exec(html)?.[1]?.replace(/\./g, "") || 0) || 600;
  const { from, to } = titleDates(/<title>([^<]*)/.exec(html)?.[1] || "");
  const pages: string[] = [];
  for (let start = 0; start < total; start += CHUNK) {
    pages.push(`${GRID}?cgid=${cgid}&prefn1=soldInStores&prefv1=000&start=${start}&sz=${CHUNK}`);
  }
  return { from, to, pages };
}

// Plain-English grocery names for the Portuguese shelf names, in one call, so
// the deals line up with the (English) recipe ingredients. Falls back to the
// Portuguese on any failure.
async function translate(apiKey: string | undefined, names: string[]): Promise<string[]> {
  if (!apiKey || !names.length) return names;
  const prompt = `Translate these Portuguese supermarket product names to short plain-English
grocery names a recipe would use (drop brands and pack sizes: "PEITO FRANGO KG" → "chicken breast",
"ATUM POSTA EM AZEITE BOM PETISCO 3X120G" → "tuna in olive oil"). Same order, same count.
Return ONLY JSON: {"names":["..."]}
${JSON.stringify(names)}`;
  try {
    const res = await fetch(geminiUrl(apiKey), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, response_mime_type: "application/json", ...MIN_THINKING },
      }),
    });
    if (!res.ok) return names;
    const data = await res.json<any>();
    const out = JSON.parse(data.candidates[0].content.parts[0].text).names;
    return Array.isArray(out) && out.length === names.length ? out.map((n: any, i: number) => (typeof n === "string" && n.trim()) || names[i]) : names;
  } catch {
    return names;
  }
}

// One grid chunk → grocery FlyerItems (English name, Portuguese original).
export async function readSfccChunk(gridUrl: string, geminiKey?: string): Promise<FlyerItem[]> {
  if (!gridUrl.startsWith(GRID)) throw new Error("not an Auchan grid URL");
  const res = await fetch(gridUrl, { headers: BROWSER });
  if (!res.ok) throw new Error(`auchan grid ${res.status}`);
  const html = await res.text();
  const seen = new Set<string>();
  const rows: { pt: string; price: number; normal: number; discount: number }[] = [];
  for (const m of html.matchAll(/data-gtm-new="([^"]+)"/g)) {
    let g: any;
    try { g = JSON.parse(unescape(m[1])); } catch { continue; }
    if (!FOOD.has(g.item_category) || seen.has(g.item_id)) continue;
    seen.add(g.item_id);
    const normal = Number(g.price), off = Number(g.discount) || 0;
    const price = Math.round((normal - off) * 100) / 100;
    if (!(price > 0)) continue;
    rows.push({ pt: String(g.item_name).trim(), price, normal, discount: off > 0 ? off / normal : 0 });
  }
  const en = await translate(geminiKey, rows.map((r) => r.pt));
  return rows.map((r, i) => {
    const discount = r.discount ? Math.round(r.discount * 1000) / 1000 : null;
    return {
      name: en[i],
      name_pt: r.pt,
      unit: /\bKG\b/i.test(r.pt) ? "kg" : "un",
      price: r.price,
      normal_price: discount ? r.normal : null,
      discount,
      good_value: !!discount && discount >= (PREMIUM.test(r.pt) ? 0.4 : 0.2),
    };
  });
}
