/**
 * Portugal seasonality data.
 *
 * Each entry lists the months (1 = Jan ... 12 = Dec) during which an item is
 * typically IN SEASON in Portugal — meaning locally abundant and therefore
 * cheaper and better quality. `peak` months are the cheapest/best subset.
 *
 * The meal-plan scoring engine uses this two ways:
 *   1. Boost recipes whose ingredients are in season this month.
 *   2. Surface a "cheap & in season" hint in the UI.
 *
 * Matching against recipe ingredients is done on the lowercased EN/PT `match`
 * aliases (substring match), so add aliases liberally as the recipe DB reveals
 * the exact ingredient strings used.
 */

export type SeasonCategory = 'vegetable' | 'fruit' | 'fish' | 'pantry';

export interface SeasonalItem {
  en: string;
  pt: string;
  category: SeasonCategory;
  /** Months it is in season in PT (locally abundant / cheaper). */
  inSeason: number[];
  /** Cheapest / best-quality subset of inSeason. */
  peak: number[];
  /** Lowercased aliases to match against recipe ingredient strings. */
  match: string[];
}

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const PT_SEASONALITY: SeasonalItem[] = [
  // ---- Year-round staples (always cheap; small/zero seasonal bonus) ----
  { en: 'Potato', pt: 'Batata', category: 'vegetable', inSeason: ALL, peak: [6, 7, 8, 9], match: ['potato', 'batata'] },
  { en: 'Onion', pt: 'Cebola', category: 'vegetable', inSeason: ALL, peak: [7, 8, 9, 10], match: ['onion', 'cebola'] },
  { en: 'Garlic', pt: 'Alho', category: 'vegetable', inSeason: ALL, peak: [6, 7, 8], match: ['garlic', 'alho'] },
  { en: 'Carrot', pt: 'Cenoura', category: 'vegetable', inSeason: ALL, peak: [10, 11, 12, 1, 2], match: ['carrot', 'cenoura'] },
  { en: 'Lemon', pt: 'Limão', category: 'fruit', inSeason: ALL, peak: [11, 12, 1, 2, 3], match: ['lemon', 'limão', 'limao'] },

  // ---- Winter (Dec–Feb) ----
  { en: 'Orange', pt: 'Laranja', category: 'fruit', inSeason: [11, 12, 1, 2, 3, 4], peak: [12, 1, 2], match: ['orange', 'laranja'] },
  { en: 'Tangerine', pt: 'Tangerina', category: 'fruit', inSeason: [11, 12, 1, 2], peak: [12, 1], match: ['tangerine', 'mandarin', 'clementine', 'tangerina'] },
  { en: 'Kale / Galician cabbage', pt: 'Couve galega', category: 'vegetable', inSeason: [10, 11, 12, 1, 2, 3], peak: [12, 1, 2], match: ['kale', 'couve', 'collard'] },
  { en: 'Cabbage', pt: 'Repolho', category: 'vegetable', inSeason: [10, 11, 12, 1, 2, 3], peak: [11, 12, 1], match: ['cabbage', 'repolho', 'couve-coração'] },
  { en: 'Cauliflower', pt: 'Couve-flor', category: 'vegetable', inSeason: [10, 11, 12, 1, 2, 3], peak: [11, 12, 1], match: ['cauliflower', 'couve-flor'] },
  { en: 'Broccoli', pt: 'Brócolos', category: 'vegetable', inSeason: [9, 10, 11, 12, 1, 2, 3], peak: [11, 12, 1], match: ['broccoli', 'brócolos', 'brocolos'] },
  { en: 'Leek', pt: 'Alho-francês', category: 'vegetable', inSeason: [10, 11, 12, 1, 2, 3], peak: [11, 12, 1], match: ['leek', 'alho-francês', 'alho frances'] },
  { en: 'Turnip', pt: 'Nabo', category: 'vegetable', inSeason: [10, 11, 12, 1, 2], peak: [11, 12, 1], match: ['turnip', 'nabo'] },
  { en: 'Turnip greens', pt: 'Grelos / Nabiças', category: 'vegetable', inSeason: [11, 12, 1, 2, 3], peak: [12, 1, 2], match: ['turnip greens', 'grelos', 'nabiças', 'nabicas'] },
  { en: 'Spinach', pt: 'Espinafres', category: 'vegetable', inSeason: [10, 11, 12, 1, 2, 3, 4], peak: [11, 12, 1, 2], match: ['spinach', 'espinafre'] },
  { en: 'Chard', pt: 'Acelga', category: 'vegetable', inSeason: [10, 11, 12, 1, 2, 3], peak: [11, 12, 1], match: ['chard', 'acelga'] },
  { en: 'Fennel', pt: 'Funcho', category: 'vegetable', inSeason: [10, 11, 12, 1, 2], peak: [11, 12, 1], match: ['fennel', 'funcho'] },
  { en: 'Pumpkin / Squash', pt: 'Abóbora', category: 'vegetable', inSeason: [9, 10, 11, 12, 1], peak: [10, 11, 12], match: ['pumpkin', 'squash', 'abóbora', 'abobora'] },
  { en: 'Apple', pt: 'Maçã', category: 'fruit', inSeason: [8, 9, 10, 11, 12, 1, 2], peak: [9, 10, 11], match: ['apple', 'maçã', 'maca'] },
  { en: 'Pear', pt: 'Pera', category: 'fruit', inSeason: [7, 8, 9, 10, 11, 12], peak: [8, 9, 10], match: ['pear', 'pera'] },

  // ---- Spring (Mar–May) ----
  { en: 'Fava beans', pt: 'Favas', category: 'vegetable', inSeason: [3, 4, 5, 6], peak: [4, 5], match: ['fava', 'broad bean', 'favas'] },
  { en: 'Peas', pt: 'Ervilhas', category: 'vegetable', inSeason: [3, 4, 5, 6], peak: [4, 5], match: ['pea', 'ervilha'] },
  { en: 'Asparagus', pt: 'Espargos', category: 'vegetable', inSeason: [3, 4, 5], peak: [4], match: ['asparagus', 'espargos'] },
  { en: 'Artichoke', pt: 'Alcachofra', category: 'vegetable', inSeason: [3, 4, 5], peak: [4], match: ['artichoke', 'alcachofra'] },
  { en: 'Strawberry', pt: 'Morango', category: 'fruit', inSeason: [3, 4, 5, 6], peak: [4, 5], match: ['strawberry', 'strawberries', 'morango'] },
  { en: 'Loquat', pt: 'Nêspera', category: 'fruit', inSeason: [4, 5], peak: [5], match: ['loquat', 'nêspera', 'nespera'] },
  { en: 'Lettuce', pt: 'Alface', category: 'vegetable', inSeason: [3, 4, 5, 6, 7, 8, 9], peak: [5, 6, 9], match: ['lettuce', 'alface'] },

  // ---- Summer (Jun–Aug) ----
  { en: 'Tomato', pt: 'Tomate', category: 'vegetable', inSeason: [6, 7, 8, 9, 10], peak: [7, 8, 9], match: ['tomato', 'tomate'] },
  { en: 'Bell pepper', pt: 'Pimento', category: 'vegetable', inSeason: [6, 7, 8, 9, 10], peak: [7, 8, 9], match: ['pepper', 'bell pepper', 'pimento', 'capsicum'] },
  { en: 'Courgette / Zucchini', pt: 'Courgette / Abobrinha', category: 'vegetable', inSeason: [6, 7, 8, 9], peak: [7, 8], match: ['courgette', 'zucchini', 'abobrinha'] },
  { en: 'Aubergine / Eggplant', pt: 'Beringela', category: 'vegetable', inSeason: [6, 7, 8, 9, 10], peak: [7, 8, 9], match: ['aubergine', 'eggplant', 'beringela'] },
  { en: 'Cucumber', pt: 'Pepino', category: 'vegetable', inSeason: [5, 6, 7, 8, 9], peak: [6, 7, 8], match: ['cucumber', 'pepino'] },
  { en: 'Green beans', pt: 'Feijão verde', category: 'vegetable', inSeason: [6, 7, 8, 9, 10], peak: [7, 8, 9], match: ['green bean', 'feijão verde', 'feijao verde', 'string bean'] },
  { en: 'Melon', pt: 'Melão', category: 'fruit', inSeason: [6, 7, 8, 9], peak: [7, 8], match: ['melon', 'melão', 'melao'] },
  { en: 'Watermelon', pt: 'Melancia', category: 'fruit', inSeason: [6, 7, 8, 9], peak: [7, 8], match: ['watermelon', 'melancia'] },
  { en: 'Peach', pt: 'Pêssego', category: 'fruit', inSeason: [6, 7, 8, 9], peak: [7, 8], match: ['peach', 'pêssego', 'pessego', 'nectarine'] },
  { en: 'Apricot', pt: 'Alperce', category: 'fruit', inSeason: [5, 6, 7], peak: [6], match: ['apricot', 'alperce', 'damasco'] },
  { en: 'Fig', pt: 'Figo', category: 'fruit', inSeason: [7, 8, 9, 10], peak: [8, 9], match: ['fig', 'figo'] },
  { en: 'Cherry', pt: 'Cereja', category: 'fruit', inSeason: [5, 6, 7], peak: [6], match: ['cherry', 'cherries', 'cereja'] },
  { en: 'Plum', pt: 'Ameixa', category: 'fruit', inSeason: [6, 7, 8, 9], peak: [7, 8], match: ['plum', 'ameixa'] },

  // ---- Autumn (Sep–Nov) ----
  { en: 'Grape', pt: 'Uva', category: 'fruit', inSeason: [8, 9, 10], peak: [9, 10], match: ['grape', 'uva'] },
  { en: 'Quince', pt: 'Marmelo', category: 'fruit', inSeason: [9, 10, 11], peak: [10], match: ['quince', 'marmelo'] },
  { en: 'Chestnut', pt: 'Castanha', category: 'fruit', inSeason: [10, 11, 12], peak: [11], match: ['chestnut', 'castanha'] },
  { en: 'Mushroom', pt: 'Cogumelos', category: 'vegetable', inSeason: [9, 10, 11, 12], peak: [10, 11], match: ['mushroom', 'cogumelo'] },
  { en: 'Pomegranate', pt: 'Romã', category: 'fruit', inSeason: [9, 10, 11], peak: [10], match: ['pomegranate', 'romã', 'roma'] },
  { en: 'Persimmon', pt: 'Dióspiro', category: 'fruit', inSeason: [10, 11, 12], peak: [11], match: ['persimmon', 'dióspiro', 'diospiro', 'kaki'] },

  // ---- Fish (Portugal has strong fish seasonality; affects price a lot) ----
  { en: 'Sardine', pt: 'Sardinha', category: 'fish', inSeason: [5, 6, 7, 8, 9, 10], peak: [6, 7, 8], match: ['sardine', 'sardinha'] },
  { en: 'Mackerel', pt: 'Cavala', category: 'fish', inSeason: [3, 4, 5, 6, 7, 8, 9], peak: [5, 6, 7], match: ['mackerel', 'cavala'] },
  { en: 'Horse mackerel', pt: 'Carapau', category: 'fish', inSeason: ALL, peak: [4, 5, 6, 7, 8, 9], match: ['horse mackerel', 'carapau', 'scad'] },
  { en: 'Octopus', pt: 'Polvo', category: 'fish', inSeason: [9, 10, 11, 12, 1], peak: [10, 11], match: ['octopus', 'polvo'] },
  { en: 'Sea bass', pt: 'Robalo', category: 'fish', inSeason: [10, 11, 12, 1, 2], peak: [11, 12], match: ['sea bass', 'robalo', 'bass'] },
  { en: 'Hake', pt: 'Pescada', category: 'fish', inSeason: ALL, peak: [1, 2, 3, 11, 12], match: ['hake', 'pescada'] },
];

/** Items in season in PT for the given month (defaults to current month). */
export function inSeasonForMonth(month: number = new Date().getMonth() + 1): SeasonalItem[] {
  return PT_SEASONALITY.filter((i) => i.inSeason.includes(month));
}

/**
 * Seasonality score for a single ingredient string, 0–1.
 *   1.0 = at peak (cheapest / best) this month
 *   0.6 = in season this month
 *   0.0 = not in season / not tracked
 */
export function ingredientSeasonScore(
  ingredient: string,
  month: number = new Date().getMonth() + 1,
): number {
  const key = ingredient.toLowerCase();
  let best = 0;
  for (const item of PT_SEASONALITY) {
    if (!item.match.some((m) => key.includes(m))) continue;
    if (item.peak.includes(month)) return 1;
    if (item.inSeason.includes(month)) best = Math.max(best, 0.6);
  }
  return best;
}

/**
 * Average seasonality score for a recipe's ingredient list, 0–1.
 * Feed this into the engine as the seasonality modifier.
 */
export function recipeSeasonScore(
  ingredients: string[],
  month: number = new Date().getMonth() + 1,
): number {
  if (!ingredients.length) return 0;
  const scored = ingredients.map((i) => ingredientSeasonScore(i, month));
  return scored.reduce((a, b) => a + b, 0) / scored.length;
}
