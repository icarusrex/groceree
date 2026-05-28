import { readFileSync } from "node:fs";
import { generatePlan, buildShoppingList, scoreAll } from "../src/engine/engine.ts";

const recipes = JSON.parse(readFileSync("./seed/recipes.seed.json", "utf8"));

function run(label, settings, opts = {}) {
  const input = { recipes, settings, seed: 42, month: 2, ...opts }; // Feb
  const plan = generatePlan(input);
  console.log(`\n================ ${label} ================`);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  for (let d = 1; d <= 7; d++) {
    const L = plan.find((p) => p.day_of_week === d && p.slot === "lunch");
    const D = plan.find((p) => p.day_of_week === d && p.slot === "dinner");
    const fmt = (p) => {
      if (!p) return "—";
      const r = byId.get(p.recipe_id);
      const tag = p.is_leftover ? " (leftovers)" : ` [${r.total_time}m]`;
      return `${r.name}${tag}`;
    };
    console.log(`${dayNames[d]}  L: ${fmt(L).padEnd(46)}  D: ${fmt(D)}`);
  }
  const list = buildShoppingList(plan, recipes, settings.household_size);
  console.log(`\nShopping list: ${list.length} line items. Sample:`);
  for (const i of list.slice(0, 12)) {
    const q = i.quantity != null ? `${Math.round(i.quantity * 10) / 10}${i.unit ? " " + i.unit : ""}` : "";
    console.log(`  [${i.category}] ${i.name} ${q}`);
  }
}

const base = { household_size: 2, diet: [], exclude_cuisines: [], max_active_minutes: null, leftover_strategy: "auto" };

run("Family of 2 — cost+ease, auto leftovers (Feb)", base);
run("Vegetarian + gluten-free", { ...base, diet: ["vegetarian", "gluten_free"] });
run("Quick weeknights only (<=30 min)", { ...base, max_active_minutes: 30 });

// sanity on eligibility counts
const elig = scoreAll({ recipes, settings: base, month: 2, seed: 1 });
console.log(`\nEligible (no diet): ${elig.length}/${recipes.length}`);
const veg = scoreAll({ recipes, settings: { ...base, diet: ["vegetarian"] }, month: 2, seed: 1 });
console.log(`Eligible (vegetarian): ${veg.length}`);
console.log(`Top 3 scoring (Feb, no diet): ${elig.slice(0, 3).map((s) => `${s.recipe.name} (${s.score.toFixed(2)})`).join("; ")}`);
