// Registry of grocery-flyer sources. Adding a store = adding one entry.
// kind:
//   "ipaper"       — viewer ships a structured price feed; we extract exactly, no AI.
//   "ipaper-image" — iPaper viewer with no price feed (prices only in the page
//                    images); we render, derive every page image, OCR with Gemini.
//   "leaflet"      — Schwarz leaflet platform (Lidl); page images are individually
//                    signed but an unauthenticated manifest API lists them; OCR with Gemini.
//   "sfcc"         — the flyer is a category on the store's shop (Auchan); exact
//                    prices read from the product grid in chunks, no OCR.
//   "manual"       — no auto-parse wired; discovery lists it, user uploads.
// Portugal only (Czech stores were removed 2026-09-28); the country field stays
// so prices/flyers keep their existing country scoping.
export type Country = "PT";
export interface StoreSource {
  id: string;
  name: string;
  country?: Country;      // which country's user sees this store (default PT)
  landing: string;        // page that links to the current flyers
  flyerHost?: string;     // host of individual flyer viewer URLs (for link filtering)
  kind: "ipaper" | "ipaper-image" | "leaflet" | "sfcc" | "manual";
  // Discovery noise control: a store lists dozens of flyers (regional editions,
  // thematic catalogues — pet food, beauty, beer). Keep only the weekly grocery
  // flyer for the mainland, most-recent week(s).
  weeklyRe?: RegExp;      // URL must match → it's the weekly grocery flyer
  excludeRe?: RegExp;     // URL must NOT match → regional/thematic edition
  weekRe?: RegExp;        // capture group 1 = ISO week number (recency rank)
  // ipaper-image discovery — one of:
  viewerLanding?: string; // render this to extract week-dated viewer URLs (then weeklyRe/weekRe rank them)
  viewerRe?: RegExp;      // which links on viewerLanding are flyer viewers
  staticViewers?: { url: string; title: string; sundayOnly?: boolean }[]; // fixed viewer URLs (no discovery render)
}

export const SOURCES: StoreSource[] = [
  // Continente & Pingo Doce: iPaper viewers whose structured feed gives names +
  // current prices but NO discount, so flat "% desconto" / "Desconto Direto" sales
  // (old→new price) were invisible. Treat them as image flyers and OCR the pages,
  // which reads the discounts and the dates ("válidos 2 — 8 junho 2026").
  { id: "pingo-doce", name: "Pingo Doce", landing: "https://www.pingodoce.pt/folhetos/",
    kind: "ipaper-image",
    viewerLanding: "https://www.pingodoce.pt/folhetos/",
    viewerRe: /https:\/\/folhetos\.pingodoce\.pt\/\d{4}\/[^"'\s)\\#]+/i,
    weeklyRe: /poupe-esta-semana/i, excludeRe: /\/(madeira|acores)\//i, weekRe: /\/S(\d+)\b/i },
  { id: "continente", name: "Continente", landing: "https://www.continente.pt/folhetos/",
    kind: "ipaper-image",
    viewerLanding: "https://www.continente.pt/folhetos/",
    viewerRe: /https:\/\/folhetos\.continente\.pt\/\d{4}\/\d{2}\/[^"'\s)\\#]+/i,
    weeklyRe: /semanal-\d+/i, excludeRe: /(semanal-\d+-mad\b|madeira|acores)/i, weekRe: /semanal-(\d+)/i },
  { id: "intermarche", name: "Intermarché", landing: "https://www.intermarche.pt/folhetos",
    kind: "ipaper-image",
    viewerLanding: "https://intermarche.pt/sign/brands/catalog-page",
    viewerRe: /https:\/\/folhetos\.intermarche\.pt\/\d{4}\/[^"'\s)\\#]+/i,
    weeklyRe: /folheto-semanal-super/i,
    excludeRe: /folheto-especial|semanal-(contact|mini)|madeira|acores/i,
    weekRe: /semana-(\d+)/i },
  // Schwarz/Lidl: page images are individually signed (no derivable list), but the
  // platform's manifest API lists them. Discovery renders the folhetos hub and
  // ranks the week-dated viewer slugs. Lidl renamed these from
  // promocoes-a-partir-de-DD-MM to promocoes-semanais-a-partir-de-DD-MM (Sep 2026);
  // accept both. promocoes-fim-de-semana-* (weekend-only) is deliberately excluded.
  { id: "lidl", name: "Lidl", landing: "https://www.lidl.pt/folhetos", kind: "leaflet",
    viewerLanding: "https://www.lidl.pt/folhetos",
    viewerRe: /https?:\/\/www\.lidl\.pt\/[^"'\s)<>\\]*folhetos\/[a-z0-9\-]+[^"'\s)<>\\]*/i,
    weeklyRe: /promocoes-(?:semanais-)?a-partir-de/i,
    excludeRe: /novidades|folheto-especial|tematic|fim-de-semana/i,
    // slug date DD-MM (e.g. promocoes-semanais-a-partir-de-28-09) → recency rank
    weekRe: /promocoes-(?:semanais-)?a-partir-de-(\d{2}-\d{2})/i },
  // Auchan: weekly flyer = shop category /pt/folheto-semanal-<week>-<n>/ (Wed–Tue).
  // The folhetos hub links it server-side, so a plain fetch finds it.
  { id: "auchan", name: "Auchan", landing: "https://www.auchan.pt/pt/folhetos/", kind: "sfcc",
    viewerRe: /\/pt\/folheto-semanal-(\d+)(?:-\d+)?\//i },
  { id: "aldi", name: "Aldi", landing: "https://www.aldi.pt/folheto/esta-semana.html",
    kind: "ipaper-image",
    staticViewers: [
      { url: "https://www.aldi.pt/folheto/esta-semana.html", title: "This week" },
      { url: "https://www.aldi.pt/folheto/proxima-semana.html", title: "Next week", sundayOnly: true },
    ] },
];

// Stores visible to a given country (defaults to PT when a source is untagged).
export const sourcesForCountry = (country: string): StoreSource[] =>
  SOURCES.filter((s) => (s.country || "PT") === "PT" && !!country);

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);
