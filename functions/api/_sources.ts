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
}

export const SOURCES: StoreSource[] = [
  { id: "pingo-doce", name: "Pingo Doce", landing: "https://www.pingodoce.pt/folhetos/",
    flyerHost: "folhetos.pingodoce.pt", kind: "ipaper" },
  { id: "continente", name: "Continente", landing: "https://www.continente.pt/folhetos/",
    flyerHost: "folhetos.continente.pt", kind: "ipaper" },
  { id: "intermarche", name: "Intermarché", landing: "https://www.intermarche.pt/folhetos",
    kind: "manual" },
  { id: "lidl", name: "Lidl", landing: "https://www.lidl.pt/folhetos", kind: "manual" },
  { id: "aldi", name: "Aldi", landing: "https://www.aldi.pt/", kind: "manual" },
];

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);
