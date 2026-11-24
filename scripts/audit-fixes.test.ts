import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dietConflicts, withAllergies } from "../src/engine/allergens.ts";
import { passesDiet, buildShoppingList } from "../src/engine/engine.ts";
import { toBuyItem } from "../src/engine/normalise.ts";
import { weekBudget, planCost } from "../src/engine/cost.ts";

const seed: any[] = JSON.parse(readFileSync(new URL("../seed/recipes.seed.json", import.meta.url), "utf8"));
const rec = (ingredients: string[], instructions: string[] = []): any =>
  ({ id: "x", name: "x", servings: 4, is_gluten_free: true, is_dairy_free: true,
     ingredients: ingredients.map((name) => ({ name, quantity: 1, unit: "", category: "pantry" })), instructions });

test("the four allergies apply even with an empty diet", () => {
  assert.deepEqual(withAllergies([]).sort(), ["dairy_free", "egg_free", "gluten_free", "soy_free"]);
  assert.deepEqual([...dietConflicts(rec(["2 tbsp soy sauce"]), []).keys()].sort(), ["gluten", "soy"]);
  const honeySoy = seed.find((r) => /honey-soy/i.test(r.name));
  assert.ok(honeySoy && !passesDiet(honeySoy, []));
});

test("no seed recipe that passes contains an allergen word in its ingredients", () => {
  const words = /\b(soy sauce|tamari|butter|cheese|milk|cream|yogh?urt|eggs?|mayo|mayonnaise|flour|bread|pasta|noodles|ranch)\b/i;
  const safe = /coconut|gluten[- ]free|dairy[- ]free|vegan|almond|cassava|tapioca|arrowroot|rice|corn|peanut|nut butter|aminos|eggplant|cream of tartar|butter (beans?|lettuce)|oat/i;
  const leaks = seed.filter((r) => passesDiet(r, []))
    .flatMap((r) => r.ingredients.filter((i: any) => words.test(i.name) && !safe.test(i.name)).map((i: any) => `${r.name}: ${i.name}`));
  assert.deepEqual(leaks, []);
});

test("method text is scanned, but a safe ingredient covers its method mention", () => {
  assert.ok(dietConflicts(rec(["pork shoulder"], ["Top with fresh salsa, cheese, and lime"]), []).has("dairy"));
  assert.ok(dietConflicts(rec(["pork chops"], ["Pour the ranch dressing into a bowl."]), []).has("egg"));
  assert.equal(dietConflicts(rec(["8 corn tortillas"], ["Warm the tortillas."]), []).size, 0);
  assert.equal(dietConflicts(rec(["tamari or coconut aminos"], ["Whisk the tamari or coconut aminos with honey."]), []).size, 0);
});

test("the shopping list keeps the safe version", () => {
  assert.match(toBuyItem("gluten-free pasta", 300, "g").name, /gluten-free pasta/);
  assert.notEqual(toBuyItem("corn tortillas", 8, "").name, "bread");
  assert.notEqual(toBuyItem("natural peanut butter", 2, "tbsp").name, "butter");
  assert.notEqual(toBuyItem("oat milk", 1, "cup").name, "milk");
  assert.match(toBuyItem("tamari soy sauce or coconut aminos", 2, "tbsp").name, /coconut aminos/);
  assert.equal(toBuyItem("eggplant", 1, "").name, "aubergine");
  assert.equal(toBuyItem("butter", 1, "tbsp").name, "butter");
});

test("pantry matches exactly: milk does not hide coconut milk", () => {
  const r: any = { id: "c", name: "c", servings: 4, ingredients: [
    { name: "coconut milk", quantity: 1, unit: "can", category: "pantry" },
    { name: "red bell pepper", quantity: 1, unit: "", category: "produce" }] };
  const plan: any[] = [{ day_of_week: 1, slot: "dinner", recipe_id: "c", is_leftover: false, leftover_of: null, servings: 4 }];
  const names = buildShoppingList(plan, [r], 4, ["milk", "black pepper"]).map((i) => i.name.toLowerCase());
  assert.ok(names.includes("coconut milk") && names.includes("bell pepper"), names.join(","));
});

test("this week's receipts fill the week instead of also shrinking it", () => {
  const day = new Date(2026, 10, 3); // Tue 3 Nov
  const none = weekBudget(800, 0, 7, day, 0).weekly;
  assert.equal(weekBudget(800, 180, 7, day, 180).weekly, none);
  assert.ok(weekBudget(800, 900, 7, new Date(2026, 10, 20), 0).weekly >= 0);
});

test("an unpriced meal costs the average priced meal, not zero", () => {
  const mk = (id: string, protein: string): any => ({ id, name: id, servings: 4, primary_protein: protein,
    ingredients: [{ name: protein, quantity: 500, unit: "g", category: protein === "trout" ? "seafood" : "meat" }] });
  const recipes = [mk("a", "chicken breast"), mk("b", "trout")];
  const prices: any = { [toBuyItem("chicken breast", 500, "g").name]: { per_kg: 8 } };
  const plan: any[] = ["a", "b"].map((id, k) => ({ day_of_week: k + 1, slot: "dinner", recipe_id: id, is_leftover: false, leftover_of: null, servings: 4 }));
  const one = planCost([plan[0]], recipes, prices).total;
  assert.ok(one > 0); assert.ok(Math.abs(planCost(plan, recipes, prices).total - 2 * one) < 0.01);
});
