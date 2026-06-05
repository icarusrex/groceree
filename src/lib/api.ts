const j = (r: Response): Promise<any> => r.json() as Promise<any>;
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
  savePlan: (p: any) => fetch("/api/plan", { method: "POST", body: JSON.stringify(p) }).then(j),
  parseFlyer: (images: any[]) =>
    fetch("/api/parse-flyer", { method: "POST", body: JSON.stringify({ images }) }).then(j),
  scanPantry: (images: any[]) =>
    fetch("/api/scan-pantry", { method: "POST", body: JSON.stringify({ images }) }).then(j),
  compareStores: (plan: any[]) =>
    fetch("/api/compare-stores", { method: "POST", body: JSON.stringify({ plan }) }).then(j),
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
  dealPlan: (store_name: string, days: number) =>
    fetch("/api/deal-plan", { method: "POST", body: JSON.stringify({ store_name, days }) }).then(j),
  delFlyer: (id: number) => fetch(`/api/flyers?id=${id}`, { method: "DELETE" }).then(j),
  flyerSources: () => fetch("/api/discover-flyers").then(j),
  discoverFlyers: (store_ids?: string[]) =>
    fetch("/api/discover-flyers", { method: "POST", body: JSON.stringify({ store_ids }) }).then(j),
  fetchFlyer: (p: { store_id?: string; store_name?: string; flyer_url: string; valid_from?: string; valid_to?: string }) =>
    fetch("/api/fetch-flyer", { method: "POST", body: JSON.stringify(p) }).then(j),
};
