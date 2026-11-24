import test from "node:test";
import assert from "node:assert/strict";
import { parseIngredientLine, findRecipeLd, recipeFromLd } from "../src/engine/importRecipe.ts";
import { recipeRow } from "../functions/api/_recipes.ts";

test("ingredient lines parse into quantity, unit and name", () => {
  assert.deepEqual(parseIngredientLine("2 1/2 cups chopped carrots"), { quantity: 2.5, unit: "cups", name: "chopped carrots" });
  assert.deepEqual(parseIngredientLine("½ tsp sea salt"), { quantity: 0.5, unit: "tsp", name: "sea salt" });
  assert.deepEqual(parseIngredientLine("1 (14-ounce) can full-fat coconut milk"), { quantity: 1, unit: "can", name: "full-fat coconut milk" });
  assert.deepEqual(parseIngredientLine("2-3 garlic cloves, minced"), { quantity: 2, unit: "", name: "garlic cloves, minced" });
  assert.deepEqual(parseIngredientLine("1 lb boneless chicken thighs"), { quantity: 1, unit: "lb", name: "boneless chicken thighs" });
  assert.equal(parseIngredientLine("Salt &amp; pepper to taste").quantity, null);
});

const page = (ld: unknown) => `<html><script type="application/ld+json">${JSON.stringify(ld)}</script></html>`;
const ld = { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage" }, {
  "@type": ["Recipe"], name: "Sheet Pan Chicken &amp; Veg", recipeYield: ["4", "4 servings"], totalTime: "PT45M",
  recipeIngredient: ["1.5 lbs chicken thighs", "2 tbsp olive oil", "1 head broccoli"],
  recipeInstructions: [{ "@type": "HowToSection", itemListElement: [{ "@type": "HowToStep", text: "Heat oven." }, { "@type": "HowToStep", text: "Roast 30 minutes." }] }],
  image: [{ url: "https://x.test/a.jpg" }] }] };

test("a JSON-LD recipe in @graph imports and saves", () => {
  const r = recipeFromLd(findRecipeLd(page(ld)), "https://x.test/r")!;
  assert.equal(r.name, "Sheet Pan Chicken & Veg");
  assert.equal(r.servings, 4); assert.equal(r.total_time, 45); assert.equal(r.primary_protein, "chicken");
  assert.deepEqual(r.instructions, ["Heat oven.", "Roast 30 minutes."]);
  assert.equal(r.image_url, "https://x.test/a.jpg");
  const row = recipeRow({ ...r, source: "link" });
  assert.ok("id" in row);
});

test("an imported recipe with an allergen is refused", () => {
  const bad = { ...ld["@graph"][1], recipeIngredient: ["1 lb chicken", "2 tbsp butter"] };
  const row = recipeRow({ ...recipeFromLd(bad, "https://x.test/b"), source: "link" });
  assert.ok("error" in row && row.status === 422 && /dairy/.test(row.error));
});
