// Shared domain types for the meal planner.

export type Diet = "gluten_free" | "vegetarian" | "pescatarian" | "dairy_free" | "egg_free" | "soy_free";
export type Slot = "lunch" | "dinner";

export interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string;
  unit_norm?: string;
  category: string; // meat | seafood | dairy | produce | pantry | frozen
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  cuisine?: string;
  difficulty?: string;
  total_time: number;
  servings: number;
  is_gluten_free: boolean;
  is_vegetarian: boolean;
  is_pescatarian: boolean;
  is_dairy_free: boolean;
  contains_dairy: boolean;
  primary_protein: string;
  cost_tier?: number; // 1 cheap … 4 premium (static, discount-free)
  ease_score: number;
  is_one_pot: boolean;
  ingredients: Ingredient[];
  instructions?: string[];
  source?: string;
}

export interface Settings {
  household_size: number;
  diet: Diet[];
  exclude_cuisines: string[];
  max_active_minutes: number | null;
  leftover_strategy: "auto" | "off";
  plan_days: number;          // dinners to generate (4 or 7)
  selected_stores: string[];  // store ids to fetch flyers from; [] = all
  country: "PT";              // Portugal only
  notion_parent_id?: string;  // Notion page the shopping list exports into
  monthly_food_budget?: number | null; // € per month; the plan and receipts compare against it
}

export interface RecipeState {
  is_favorite?: boolean;
  is_hidden?: boolean;
  times_cooked?: number;
  times_skipped?: number;
  last_cooked_at?: string | null; // ISO date
}

export interface PlanItem {
  day_of_week: number; // 1=Mon..7=Sun
  slot: Slot;
  recipe_id: string | null;
  is_leftover: boolean;
  leftover_of?: { day_of_week: number; slot: Slot } | null;
  servings: number;
}

export interface GenerateInput {
  recipes: Recipe[];
  settings: Settings;
  pantry?: string[]; // raw pantry item names
  states?: Record<string, RecipeState>; // recipeId -> learning state
  deals?: Record<string, number>; // ingredient name (lower) -> discount 0..1
  month?: number; // 1..12, defaults to current
  seed?: number; // for reproducible jitter
  start_date?: string; // ISO date; omitted uses Monday ordering
  days?: number; // dinners to fill (defaults to settings.plan_days or 4)
}
