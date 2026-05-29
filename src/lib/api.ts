const j = (r: Response) => r.json();
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
  remix: (recipe: any, instruction: string) =>
    fetch("/api/remix-recipe", { method: "POST", body: JSON.stringify({ recipe, instruction }) }).then(j),
  createRecipe: (recipe: any) =>
    fetch("/api/recipes", { method: "POST", body: JSON.stringify(recipe) }).then(j),
  prices: () => fetch("/api/prices").then(j),
  generateImage: (recipe_id: string, name: string, description: string) =>
    fetch("/api/generate-image", { method: "POST", body: JSON.stringify({ recipe_id, name, description }) }).then(j),
  pantryRecipes: () => fetch("/api/pantry-recipes", { method: "POST", body: "{}" }).then(j),
  flyers: () => fetch("/api/flyers").then(j),
  delFlyer: (id: number) => fetch(`/api/flyers?id=${id}`, { method: "DELETE" }).then(j),
};
