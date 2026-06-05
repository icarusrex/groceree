// Shared flyer persistence. Underscore prefix = not routed.
// Both the Gemini vision parser (parse-flyer) and the structured iPaper
// extractor (fetch-flyer) normalise to this shape, then call persistFlyer.

export interface FlyerItem {
  name: string;            // english where available, else original
  name_pt?: string | null;
  unit?: string | null;
  price: number | null;
  normal_price?: number | null;
  discount?: number | null;   // 0..1
  good_value?: boolean;
}

export interface ParsedFlyer {
  store: string;
  valid_from?: string | null;
  valid_to?: string | null;
  summary?: string | null;
  items: FlyerItem[];
  page_count?: number;
}

export const storeIdOf = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

// Grocery category from a product name (bilingual PT/EN). Returns null for
// non-grocery items (homeware, electronics, clothing) so flyer feeds that dump
// the whole catalogue don't pollute price comparison. Structured iPaper feeds
// give Portuguese names; Gemini gives English.
export type FoodCat = "meat" | "fish" | "dairy" | "produce" | "pantry";
// Non-grocery that shares keywords with food. Two families:
//  - appliances/homeware (an air fryer matches "oil", a coffee machine "coffee")
//  - personal care / household (Portuguese "pasta de dentes" = toothpaste matches
//    "pasta"; cleaning/beauty/pet items pad the full-catalogue structured feeds)
// Block these before food matching so they never reach price-comparison or picks.
const NONFOOD = /maquina|fritadeira|torradeira|liquidificad|batedeira|robot|microond|aspirador|frigorific|congelador\b|\barca\b|fogao|forno\b|grelhador|frigideira|\bpanela|tacho|faqueiro|talher|chavena|caneca|hoffen|\btv\b|telemovel|portatil|auricular|colchao|almofada|toalha|edredao|panela|parodontax|sensodyne|colgate|aquafresh|elmex|oral-?b|dentifric|toothpaste|\bdentes?\b|mouthwash|shampoo|champ[oô]|condicionador|gel de banho|sabonete|\bsoap\b|body milk|nivea|dove\b|creme corpo|hidratante|desodor|deodorant|\brazor|gill?ett?e|barbear|aftershave|maquilha|makeup|verniz|perfume|col[oó]nia|fralda|diaper|penso higi|t[aâ]mpon|papel higi|len[cç]o|detergent|deterg|lix[ií]via|amaciador|limpa-|cleaner|sonasol|ambientador|airwick|air ?wick|glade|febre[sz]e|inseticida|velas?\b|guardanapo|ra[cç][aã]o\b/i;
export function categorize(name: string): FoodCat | null {
  if (NONFOOD.test(name)) return null;
  const n = name.toLowerCase();
  if (/chicken|beef|pork|lamb|turkey|sausage|bacon|mince|steak|ham\b|frango|carne|porco|vaca|vitela|borrego|peru|salsich|fiambre|chouric|lombo|bife|alheira|enchido|presunto|febras|costela|panados?/.test(n)) return "meat";
  if (/fish|salmon|cod|tuna|prawn|shrimp|sardine|hake|squid|peixe|salmao|bacalhau|atum|camar|gambas|sardinh|pescada|lulas|polvo|dourada|robalo|marisco|delicias do mar/.test(n)) return "fish";
  if (/milk|cheese|yogurt|yoghurt|butter|cream|egg|leite|queijo|iogurte|manteiga|natas|ovo|requeijao|flamengo|barrar/.test(n)) return "dairy";
  if (/apple|banana|tomato|onion|potato|carrot|lettuce|pepper|fruit|veg\b|salad|orange|lemon|maca|tomate|cebola|batata|cenoura|alface|piment|fruta|legume|salada|laranja|limao|alho|couve|brocolo|espinafre|pera|uva|morango|melao|meloa|abacate|courgette|curgete|pepino|alface|cogumelo|abobora|nabo|alho frances/.test(n)) return "produce";
  if (/rice|pasta|spaghetti|noodle|oil|olive|vinegar|coffee|tea\b|sugar|salt|flour|bean|lentil|chickpea|cereal|oat|bread|tin|tinned|canned|water|juice|soup|sauce|biscuit|cookie|chocolate|jam|honey|frozen|pizza|wine|beer|snack|crisps|chips|nuts|spice|ketchup|mayo|mustard|margarine|cracker|yeast|cocoa|\bmel\b|arroz|massa|esparguete|azeite|oleo|vinagre|cafe|cha\b|acucar|\bsal\b|farinha|feijao|grao|lentilha|bolacha|chocolate|compota|congelad|sumo|agua|sopa|molho|conserva|atum|cereais|aveia|\bpao\b|bolo|cerveja|vinho|aperitiv|snack|batata frita|frutos secos|especiaria|mostarda|maionese|margarina|levedura|cacau|leite condensado|tremoco|azeitona|piri|caldo|\bmel\b|gelado|iogurte|refrigerante|nestea|compal/.test(n)) return "pantry";
  return null;
}

// --- Gemini vision parse (fallback for stores with no structured feed) ---
const COST_RULE = `Cheap staples (chicken thighs, mince, eggs, beans, lentils,
potatoes, onions, carrots, cabbage, frozen veg, tinned tomatoes, seasonal produce)
are good value. Premium items (lobster, prawns, scallops, fresh tuna/sea bass,
steak, lamb, duck, pine nuts, saffron, aged cheese) are NOT good value just because
discounted — a small discount on an expensive item is still expensive. Only treat a
premium item as a deal if the discount is 40%+.`;

const PROMPT = `You are reading a supermarket flyer (Portugal). Extract the
discounted grocery items. ${COST_RULE}
Discounts appear several ways: a crossed-out original price next to a lower one
("Desconto Direto" / "Poupe X€"), or a flat percentage badge ("-15%", "15% de
desconto", sometimes "com Cartão"). Whenever a reduction is shown, set
normal_price to the original price and discount to the fraction off (0..1). If
only a "% desconto" badge is shown with one price, treat that price as the sale
price and set discount from the badge (normal_price may be null).
Return ONLY JSON, no prose, shaped:
{"store": "<name>", "valid_from": "YYYY-MM-DD|null", "valid_to": "YYYY-MM-DD|null",
 "summary": "<one short sentence: notable cheap items / any theme>",
 "items": [{"name": "<english grocery name>", "name_pt": "<portuguese>",
            "price": <number>, "normal_price": <number|null>, "unit": "<e.g. kg|un>",
            "discount": <0..1>, "good_value": <true|false>}]}
Set good_value=false for premium items with shallow discounts per the rule above.`;

// Accepts images and/or PDFs as inline base64 parts. Throws on failure.
export async function geminiParse(
  apiKey: string,
  media: { mime: string; data: string }[],
): Promise<ParsedFlyer> {
  const parts: any[] = [{ text: PROMPT }];
  for (const m of media) parts.push({ inline_data: { mime_type: m.mime || "image/jpeg", data: m.data } });
  const model = "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.1, response_mime_type: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  const data = await res.json<any>();
  const txt = data.candidates[0].content.parts[0].text.replace(/^```(json)?|```$/gm, "").trim();
  return JSON.parse(txt);
}

// Text-only theme summary for an already-parsed flyer (e.g. the iPaper feed,
// which has names+prices but no AI pass). One short shop-this hint like
// "Mexican week" or "great fish deals". Returns null if no key / no items / on
// any failure — callers fall back to the generic product-count summary.
export async function summariseFlyer(
  apiKey: string | undefined,
  store: string,
  items: FlyerItem[],
): Promise<string | null> {
  if (!apiKey || !items.length) return null;
  const top = items
    .filter((i) => i.name)
    .sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0))
    .slice(0, 80)
    .map((i) => (i.discount ? `${i.name} (-${Math.round(i.discount * 100)}%)` : i.name))
    .join(", ");
  const prompt = `Portuguese supermarket flyer for ${store}. Notable items:\n${top}\n\n` +
    `In ONE short sentence (max 16 words) tell a home cook what's worth buying or ` +
    `any theme this week (e.g. "Mexican week", "great fish deals", "stock up on chicken"). ` +
    `Plain text only, no quotes, no preamble.`;
  const model = "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 60 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json<any>();
    const txt = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim()
      .replace(/^["']|["']$/g, "");
    return txt || null;
  } catch { return null; }
}

// Writes stores/store_prices/flyers rows and returns the good-value deals map.
export async function persistFlyer(
  db: D1Database,
  user: string,
  parsed: ParsedFlyer,
  storeId = storeIdOf(parsed.store || "unknown"),
): Promise<Record<string, number>> {
  const storeName = parsed.store || "unknown";
  await db.prepare("INSERT OR IGNORE INTO stores (id,name) VALUES (?,?)")
    .bind(storeId, storeName).run();

  const day = parsed.valid_from || new Date().toISOString().slice(0, 10);
  const source = `flyer:${storeId}:${day}`;
  const deals: Record<string, number> = {};

  // Re-fetching the same flyer replaces it rather than stacking duplicates.
  await db.prepare("DELETE FROM store_prices WHERE source = ?").bind(source).run();
  await db.prepare(
    "DELETE FROM flyers WHERE user_id=? AND store_id=? AND IFNULL(valid_from,'')=IFNULL(?,'')",
  ).bind(user, storeId, parsed.valid_from ?? null).run();

  // Chunk inserts so a large iPaper catalog (1000+ rows) stays within D1 limits.
  const items = (parsed.items || []).filter((it) => it && it.name);
  for (const it of items) {
    await db.prepare(
      `INSERT INTO store_prices (store_id,item_name,item_name_pt,unit,price,normal_price,
        discount,valid_from,valid_to,source) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).bind(storeId, it.name, it.name_pt ?? null, it.unit ?? null, it.price ?? null,
           it.normal_price ?? null, it.discount ?? null,
           parsed.valid_from ?? null, parsed.valid_to ?? null, source).run();
    if (it.good_value && it.discount) deals[it.name.toLowerCase()] = it.discount;
  }

  await db.prepare(
    `INSERT INTO flyers (user_id, store_id, store_name, valid_from, valid_to,
       summary, item_count, deals) VALUES (?,?,?,?,?,?,?,?)`,
  ).bind(user, storeId, storeName, parsed.valid_from ?? null,
         parsed.valid_to ?? null, parsed.summary ?? null,
         items.length, JSON.stringify(deals)).run();

  return deals;
}
