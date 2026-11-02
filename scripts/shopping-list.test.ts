import test from "node:test";
import assert from "node:assert/strict";
import { buildShoppingList, tidyAmount } from "../src/engine/engine.ts";

// Recipes imported by the "clean" pipeline carry ingredients without a category.
// Unknown ones used to come back with category undefined and crash the sort,
// blanking the Shop tab for any plan that contained them.
const recipes: any[] = [
  { id: "stew", name: "Apple Cider Beef Stew", servings: 4, ingredients: [
    { name: "beef stew meat", quantity: 2, unit: "pounds" },
    { name: "apple cider juice", quantity: 2, unit: "cups" },
    { name: "arrowroot powder", quantity: 2, unit: "tablespoons" },
    { name: "small-to-medium turnips", quantity: 2, unit: "unit" },
    { name: "carrots", quantity: 4, unit: "medium" } ] },
  { id: "chops", name: "Simple Seared Pork Chops", servings: 4, ingredients: [
    { name: "boneless pork chops", quantity: 1.5, unit: "pounds" },
    { name: "Texas Grill Rub", quantity: 2, unit: "tablespoons" } ] },
];

test("ingredients without a category still build a shopping list", () => {
  const plan: any[] = [
    { day_of_week: 1, slot: "dinner", recipe_id: "stew", is_leftover: false, leftover_of: null, servings: 4 },
    { day_of_week: 2, slot: "dinner", recipe_id: "chops", is_leftover: false, leftover_of: null, servings: 4 },
  ];
  const list = buildShoppingList(plan, recipes, 4);
  assert.ok(list.length > 0);
  for (const i of list) { assert.equal(typeof i.category, "string"); tidyAmount(i); }
});
