const j = (r: Response): Promise<any> => r.json() as Promise<any>;
// Plan reads/writes must fail on HTTP errors, including stale-revision conflicts.
const planJson = async (r: Response): Promise<any> => {
  if (!r.ok) {
    const body = await r.json().catch(() => null) as any;
    throw Object.assign(new Error(body?.error || "Could not sync your cloud plan."), { status: r.status });
  }
  const body = await r.json() as any;
  if (body?.error) throw new Error(body.error);
  return body;
};
export const api = {
  recipes: () => fetch("/api/recipes").then(j),
  settings: () => fetch("/api/settings").then(j),
  saveSettings: (s: any) => fetch("/api/settings", { method: "PUT", body: JSON.stringify(s) }).then(j),
  states: () => fetch("/api/state").then(j),
  signal: (recipe_id: string, signal: string) =>
    fetch("/api/state", { method: "POST", body: JSON.stringify({ recipe_id, signal }) }).then(j),
  pantry: () => fetch("/api/pantry").then(j),
  addPantry: (raw_text: string, source = "manual") =>
    fetch("/api/pantry", { method: "POST", body: JSON.stringify({ raw_text, source }) }).then(j),
  delPantry: (id: number) => fetch(`/api/pantry?id=${id}`, { method: "DELETE" }).then(j),
  plan: () => fetch("/api/plan?active=1",
    { cache: "no-store", signal: AbortSignal.timeout(15000) }).then(planJson),
  savePlan: (p: import("./planSync.ts").PlanWrite) => fetch("/api/plan", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p),
    signal: AbortSignal.timeout(15000),
  }).then(planJson),
  parseFlyer: (images: any[]) =>
    fetch("/api/parse-flyer", { method: "POST", body: JSON.stringify({ images }) }).then(j),
  scanPantry: (images: any[]) =>
    fetch("/api/scan-pantry", { method: "POST", body: JSON.stringify({ images }) }).then(j),
  scanReceipt: (images: any[]) =>
    fetch("/api/scan-receipt", { method: "POST", body: JSON.stringify({ images }) }).then(j),
  compareStores: (plan: any[]) =>
    fetch("/api/compare-stores", { method: "POST", body: JSON.stringify({ plan }) }).then(j),
  scaleMethod: (p: { recipe: any; servings: number; leftovers?: number }) =>
    fetch("/api/scale-method", { method: "POST", body: JSON.stringify(p), signal: AbortSignal.timeout(60000) }).then(j),
  remix: (recipe: any, instruction: string) =>
    fetch("/api/remix-recipe", { method: "POST", body: JSON.stringify({ recipe, instruction }) }).then(j),
  editPlan: (plan: any[], instruction: string) =>
    fetch("/api/edit-plan", { method: "POST", body: JSON.stringify({ plan, instruction }) }).then(j),
  createRecipe: (recipe: any) =>
    fetch("/api/recipes", { method: "POST", body: JSON.stringify(recipe) }).then(j),
  prices: () => fetch("/api/prices").then(j),
  basket: () => fetch("/api/basket").then(j),
  basketSet: (item: string, store: string, price: number | null) =>
    fetch("/api/basket", { method: "POST", body: JSON.stringify({ op: "set", item, store, price }) }).then(j),
  basketItem: (op: "addItem" | "removeItem" | "renameItem", item: string, to?: string) =>
    fetch("/api/basket", { method: "POST", body: JSON.stringify({ op, item, to }) }).then(j),
  generateImage: (recipe_id: string, name: string, description: string) =>
    fetch("/api/generate-image", { method: "POST", body: JSON.stringify({ recipe_id, name, description }) }).then(j),
  flyers: () => fetch("/api/flyers").then(j),
  bestDeals: () => fetch("/api/best-deals").then(j),
  delFlyer: (id: number) => fetch(`/api/flyers?id=${id}`, { method: "DELETE" }).then(j),
  flyerSources: () => fetch("/api/discover-flyers").then(j),
  discoverFlyers: (store_ids?: string[]) =>
    fetch("/api/discover-flyers", { method: "POST", body: JSON.stringify({ store_ids }) }).then(j),
  fetchFlyer: (p: { store_id?: string; store_name?: string; flyer_url: string; valid_from?: string; valid_to?: string }) =>
    fetch("/api/fetch-flyer", { method: "POST", body: JSON.stringify(p), signal: AbortSignal.timeout(150000) }).then(j),
  // Per-page flyer flow (keeps each Worker request under the CPU limit):
  // flyerPages → loop ocrPage per page → saveFlyer with the merged items.
  flyerPages: (p: { store_id?: string; flyer_url: string }) =>
    fetch("/api/flyer-pages", { method: "POST", body: JSON.stringify(p), signal: AbortSignal.timeout(60000) }).then(j),
  ocrPage: (p: { image_url: string } | { image: { mime: string; data: string } }) =>
    fetch("/api/ocr-page", { method: "POST", body: JSON.stringify(p), signal: AbortSignal.timeout(120000) }).then(j),
  priceBook: () => fetch("/api/price-book").then(j),
  priceFill: (items: string[]) =>
    fetch("/api/price-fill", { method: "POST", body: JSON.stringify({ items }), signal: AbortSignal.timeout(90000) }).then(j),
  spend: (week_start: string) => fetch(`/api/spend?week_start=${week_start}`).then(j),
  gridPage: (p: { url: string }) =>
    fetch("/api/grid-page", { method: "POST", body: JSON.stringify(p), signal: AbortSignal.timeout(60000) }).then(j),
  saveFlyer: (p: { store_id?: string; store_name: string; valid_from?: string | null; valid_to?: string | null; summary?: string | null; items: any[]; page_count?: number }) =>
    fetch("/api/save-flyer", { method: "POST", body: JSON.stringify(p) }).then(j),
  generateRecipe: (p: { prompt: string; servings: number; diet?: string[]; max_active_minutes?: number | null; country?: string }) =>
    fetch("/api/generate-recipe", { method: "POST", body: JSON.stringify(p), signal: AbortSignal.timeout(60000) }).then(j),
};
