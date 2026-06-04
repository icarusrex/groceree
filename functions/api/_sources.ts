// Registry of grocery-flyer sources. Adding a store = adding one entry.
// kind:
//   "ipaper" — viewer ships a structured price feed; we extract exactly, no AI.
//   "manual" — no structured feed wired yet; discovery still lists it, but the
//              user downloads/uploads and Gemini vision parses (existing path).
export interface StoreSource {
  id: string;
  name: string;
  landing: string;        // page that links to the current flyers
  flyerHost?: string;     // host of individual flyer viewer URLs (for link filtering)
  kind: "ipaper" | "manual";
  // Discovery noise control: a store lists dozens of flyers (regional editions,
  // thematic catalogues — pet food, beauty, beer). Keep only the weekly grocery
  // flyer for the mainland, most-recent week(s).
  weeklyRe?: RegExp;      // URL must match → it's the weekly grocery flyer
  excludeRe?: RegExp;     // URL must NOT match → regional/thematic edition
  weekRe?: RegExp;        // capture group 1 = ISO week number (recency rank)
}

export const SOURCES: StoreSource[] = [
  { id: "pingo-doce", name: "Pingo Doce", landing: "https://www.pingodoce.pt/folhetos/",
    flyerHost: "folhetos.pingodoce.pt", kind: "ipaper",
    weeklyRe: /poupe-esta-semana/i, excludeRe: /\/(madeira|acores)\//i, weekRe: /\/S(\d+)\b/i },
  { id: "continente", name: "Continente", landing: "https://www.continente.pt/folhetos/",
    flyerHost: "folhetos.continente.pt", kind: "ipaper",
    weeklyRe: /semanal-\d+/i, excludeRe: /(semanal-\d+-mad\b|madeira|acores)/i, weekRe: /semanal-(\d+)/i },
  { id: "intermarche", name: "Intermarché", landing: "https://www.intermarche.pt/folhetos",
    kind: "manual" },
  { id: "lidl", name: "Lidl", landing: "https://www.lidl.pt/folhetos", kind: "manual" },
  { id: "aldi", name: "Aldi", landing: "https://www.aldi.pt/", kind: "manual" },
];

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);
