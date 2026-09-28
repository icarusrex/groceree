// The user's diet as prompt rules for every endpoint that asks Gemini to write
// or change a recipe. Gluten, dairy, egg and soy are allergies in this
// household: the wording is absolute, and it names the traps (tamari is
// gluten-free but soy; lactose-free is still dairy; stock cubes).
export const DIET_RULES: Record<string, string> = {
  gluten_free: "ALLERGY: no gluten — no wheat, barley, rye, regular pasta/bread/flour, soy sauce, beer or malt; use gluten-free versions",
  dairy_free: "ALLERGY: no dairy — no milk, butter, ghee, cream, cheese or yogurt, and lactose-free products still count as dairy; use olive oil, coconut milk/cream",
  egg_free: "ALLERGY: no egg — no eggs, mayonnaise, aioli or egg pasta/noodles; bind with flax/chia or aquafaba",
  soy_free: "ALLERGY: no soy — no soy sauce, tamari, teriyaki, tofu, tempeh, miso or edamame; use coconut aminos",
  vegetarian: "must be vegetarian (no meat, no fish)",
  pescatarian: "no meat other than fish/seafood",
};

export function dietRules(diet: string[]): string[] {
  const rules = diet.map((d) => DIET_RULES[d]).filter(Boolean);
  if (diet.some((d) => /_(free)$/.test(d))) rules.push("for stock, use homemade stock or a cube verified free of these allergens");
  return rules;
}

export async function userDiet(db: D1Database, user: string): Promise<string[]> {
  const row = await db.prepare("SELECT diet FROM user_settings WHERE user_id=?").bind(user).first<{ diet: string }>();
  try { return JSON.parse(row?.diet || "[]"); } catch { return []; }
}
