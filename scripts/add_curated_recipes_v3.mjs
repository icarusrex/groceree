// Curated backfill batch v3 — top-up to clear 300 clean recipes. Same hand-
// authored, complete-instruction pattern as v2. Idempotent (dedupes by id/name).
// Run: node scripts/add_curated_recipes_v3.mjs
import { readFileSync, writeFileSync } from "node:fs";
const SOURCE = "curated-v2";
const NORM = { cups: "cup", cup: "cup", tablespoons: "tbsp", tablespoon: "tbsp", tbsp: "tbsp",
  teaspoons: "tsp", teaspoon: "tsp", tsp: "tsp", cloves: "clove", clove: "clove",
  pounds: "lb", pound: "lb", lbs: "lb", lb: "lb", ounces: "oz", ounce: "oz", oz: "oz",
  can: "can", cans: "can", "": "", g: "g", ml: "ml", bunch: "bunch", inch: "inch", stalk: "stalk", sprig: "sprig" };
const ing = (name, quantity, unit, category) => ({ name, quantity, unit, unit_norm: NORM[unit] ?? unit, category });
const P = (n, q, u = "") => ing(n, q, u, "pantry");
const V = (n, q, u = "") => ing(n, q, u, "produce");
const M = (n, q, u = "") => ing(n, q, u, "meat");
const F = (n, q, u = "") => ing(n, q, u, "seafood");
const D = (n, q, u = "") => ing(n, q, u, "dairy");
const R = [];
const add = (r) => R.push({ meal_type: "dinner", cuisine: null, difficulty: "easy", servings: 4, cost_tier: 2,
  ease_score: 0.6, is_gluten_free: false, is_vegetarian: false, is_pescatarian: false, is_dairy_free: false,
  contains_dairy: false, is_one_pot: false, primary_protein: "none", source: SOURCE, ...r,
  prep_time: r.prep_time ?? 10, total_time: r.total_time ?? (r.prep_time ?? 10) + (r.cook_time ?? 20),
  ingredient_count: r.ingredients.length });

add({ id: "honey-garlic-chicken-thighs", name: "Honey Garlic Chicken Thighs",
  description: "Sticky pan-seared chicken thighs in a honey, garlic and soy glaze.",
  cuisine: "asian", cook_time: 25, calories_per_serving: 430, primary_protein: "chicken", is_dairy_free: true, ease_score: 0.85,
  ingredients: [M("Chicken thighs", 8), V("Garlic", 5, "clove"), P("Honey", 3, "tbsp"), P("Soy sauce", 3, "tbsp"),
    P("Rice vinegar", 1, "tbsp"), V("Spring onions", 2), P("Vegetable oil", 1, "tbsp"), P("Cooked rice", 4, "cup")],
  instructions: ["Sear the seasoned thighs skin-side down until golden, then flip and cook through; remove.",
    "Lower the heat and soften the garlic in the rendered fat.",
    "Add the honey, soy and vinegar and simmer to a syrup.",
    "Return the chicken and turn to coat in the glaze.",
    "Scatter with spring onions and serve over rice."] });

add({ id: "beef-broccoli-stirfry", name: "Beef & Broccoli Stir-Fry",
  description: "Tender beef and broccoli in a glossy ginger-soy sauce.",
  cuisine: "asian", cook_time: 18, calories_per_serving: 410, primary_protein: "beef", is_dairy_free: true, ease_score: 0.8,
  ingredients: [M("Beef strips", 500, "g"), V("Broccoli", 1), V("Garlic", 3, "clove"), V("Ginger", 1, "tbsp"),
    P("Soy sauce", 3, "tbsp"), P("Oyster sauce", 2, "tbsp"), P("Cornstarch", 1, "tbsp"), P("Vegetable oil", 2, "tbsp"), P("Cooked rice", 4, "cup")],
  instructions: ["Toss the beef with a little soy and cornstarch.",
    "Blanch the broccoli florets for 2 minutes; drain.",
    "Sear the beef in a hot wok in batches, then set aside.",
    "Stir-fry the garlic and ginger, add the sauces and a splash of water, and thicken.",
    "Return the beef and broccoli, toss to coat, and serve over rice."] });

add({ id: "sausage-pepper-traybake", name: "Sausage & Pepper Traybake",
  description: "Sausages roasted with peppers, onions and new potatoes in one tray.",
  cuisine: "american", cook_time: 40, calories_per_serving: 500, primary_protein: "pork", is_dairy_free: true, is_gluten_free: true, ease_score: 0.9,
  ingredients: [M("Pork sausages", 8), V("Bell peppers", 3), V("Red onions", 2), V("New potatoes", 600, "g"),
    V("Garlic", 4, "clove"), P("Olive oil", 3, "tbsp"), P("Dried oregano", 1, "tbsp"), P("Smoked paprika", 1, "tsp")],
  instructions: ["Halve the potatoes and toss with oil, oregano and paprika in a large tray.",
    "Roast at 200C for 15 minutes.",
    "Add the sausages, sliced peppers, onions and garlic.",
    "Roast 25 minutes more, turning once, until everything is browned and the potatoes are tender.",
    "Season and serve straight from the tray."] });

add({ id: "creamy-tuscan-chicken", name: "Creamy Tuscan Chicken",
  description: "Pan-seared chicken in a creamy sun-dried tomato and spinach sauce.",
  cuisine: "italian", cook_time: 25, calories_per_serving: 480, primary_protein: "chicken", contains_dairy: true, is_gluten_free: true, ease_score: 0.8,
  ingredients: [M("Chicken breasts", 4), P("Sun-dried tomatoes", 0.5, "cup"), V("Spinach", 150, "g"), V("Garlic", 3, "clove"),
    D("Cream", 0.75, "cup"), D("Parmesan", 0.5, "cup"), P("Chicken stock", 0.5, "cup"), P("Olive oil", 2, "tbsp")],
  instructions: ["Sear the seasoned chicken until golden and cooked through; set aside.",
    "Soften the garlic and sun-dried tomatoes in the pan.",
    "Add the stock and cream and simmer to thicken.",
    "Stir in the parmesan and wilt in the spinach.",
    "Return the chicken to coat and serve with pasta or bread."] });

add({ id: "shrimp-fried-rice", name: "Shrimp Fried Rice",
  description: "Wok-fried rice with shrimp, egg, peas and spring onion.",
  cuisine: "asian", cook_time: 15, calories_per_serving: 400, primary_protein: "fish", is_pescatarian: true, is_dairy_free: true, ease_score: 0.85, is_one_pot: true,
  ingredients: [F("Shrimp, peeled", 300, "g"), P("Cooked cold rice", 4, "cup"), D("Eggs", 2), P("Frozen peas", 1, "cup"),
    V("Carrot", 1), V("Spring onions", 3), V("Garlic", 2, "clove"), P("Soy sauce", 3, "tbsp"), P("Sesame oil", 1, "tbsp")],
  instructions: ["Scramble the eggs in oil and set aside.",
    "Stir-fry the shrimp until pink; remove.",
    "Fry the diced carrot, garlic and peas, then add the cold rice and toss over high heat.",
    "Add the soy and sesame oil.",
    "Return the egg and shrimp, toss with spring onions, and serve."] });

add({ id: "moroccan-lamb-meatballs", name: "Moroccan Lamb Meatballs in Tomato",
  description: "Spiced lamb meatballs simmered in tomato sauce with eggs cracked on top.",
  cuisine: "middle-eastern", cook_time: 35, calories_per_serving: 460, primary_protein: "lamb", is_gluten_free: true, ease_score: 0.65, is_one_pot: true,
  ingredients: [M("Lamb mince", 500, "g"), P("Cumin", 1, "tsp"), P("Cinnamon", 0.5, "tsp"), V("Onion", 1),
    V("Garlic", 3, "clove"), P("Canned tomatoes", 1, "can"), D("Eggs", 4), V("Cilantro", 0.5, "cup"), P("Paprika", 1, "tsp")],
  instructions: ["Mix the lamb with half the spices, salt and a little grated onion; roll into small meatballs.",
    "Brown the meatballs in a pan; set aside.",
    "Soften the rest of the onion and garlic, add the remaining spices and the tomatoes, and simmer 10 minutes.",
    "Return the meatballs and simmer 10 minutes.",
    "Crack in the eggs, cover, and cook until set; finish with cilantro."] });

add({ id: "veg-coconut-dal", name: "Coconut Vegetable Dal",
  description: "Red lentil dal with coconut milk and mixed vegetables.",
  cuisine: "indian", cook_time: 30, calories_per_serving: 360, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, is_dairy_free: true, is_gluten_free: true, cost_tier: 1, ease_score: 0.85, is_one_pot: true,
  ingredients: [P("Red lentils", 1.5, "cup"), D("Coconut milk", 1, "can"), V("Onion", 1), V("Garlic", 3, "clove"),
    V("Ginger", 1, "tbsp"), V("Carrot", 1), V("Spinach", 150, "g"), P("Curry powder", 2, "tbsp"), P("Turmeric", 1, "tsp")],
  instructions: ["Soften onion, garlic and ginger, then toast the curry powder and turmeric.",
    "Add the rinsed lentils, diced carrot, coconut milk and 2 cups water.",
    "Simmer 20 minutes until the lentils collapse, stirring now and then.",
    "Wilt in the spinach.",
    "Season and serve with rice or flatbread."] });

add({ id: "pesto-gnocchi-peas", name: "Pesto Gnocchi with Peas",
  description: "Quick gnocchi tossed with pesto, peas and parmesan.",
  cuisine: "italian", cook_time: 15, calories_per_serving: 430, primary_protein: "none",
  is_vegetarian: true, contains_dairy: true, cost_tier: 1, ease_score: 0.9,
  ingredients: [P("Potato gnocchi", 500, "g"), P("Basil pesto", 4, "tbsp"), P("Frozen peas", 1.5, "cup"),
    D("Parmesan", 0.33, "cup"), V("Lemon", 1), P("Olive oil", 1, "tbsp"), V("Basil", 0.25, "cup")],
  instructions: ["Boil the gnocchi until they float, adding the peas for the last 2 minutes.",
    "Reserve a little cooking water, then drain.",
    "Toss with the pesto and a splash of the water to loosen.",
    "Stir in the parmesan and a squeeze of lemon.",
    "Finish with torn basil and a drizzle of oil."] });

add({ id: "korean-tofu-stew", name: "Sundubu Jjigae (Soft Tofu Stew)",
  description: "Spicy Korean soft tofu stew with vegetables and a cracked egg.",
  cuisine: "asian", cook_time: 25, calories_per_serving: 300, primary_protein: "none",
  is_vegetarian: true, is_dairy_free: true, cost_tier: 1, ease_score: 0.7, is_one_pot: true,
  ingredients: [D("Silken tofu", 400, "g"), P("Gochugaru chilli flakes", 2, "tbsp"), V("Onion", 1), V("Garlic", 3, "clove"),
    V("Mushrooms", 150, "g"), V("Courgette", 1), D("Egg", 1), P("Soy sauce", 2, "tbsp"), P("Sesame oil", 1, "tbsp"), V("Spring onions", 2)],
  instructions: ["Fry the gochugaru in sesame oil briefly, then add onion and garlic.",
    "Add sliced mushrooms and courgette and cook 3 minutes.",
    "Pour in 3 cups water and the soy and bring to a boil.",
    "Spoon in big curds of the soft tofu and simmer 5 minutes.",
    "Crack in the egg, scatter spring onions, and serve bubbling with rice."] });

add({ id: "smoky-bean-burgers", name: "Smoky Black Bean Burgers",
  description: "Hearty spiced black bean patties for buns or bowls.",
  cuisine: "american", cook_time: 25, calories_per_serving: 380, primary_protein: "none",
  is_vegetarian: true, cost_tier: 1, ease_score: 0.7,
  ingredients: [P("Black beans", 2, "can"), V("Onion", 1), V("Garlic", 2, "clove"), P("Breadcrumbs", 0.75, "cup"),
    D("Egg", 1), P("Cumin", 1, "tsp"), P("Smoked paprika", 1, "tsp"), P("Burger buns", 4), V("Lettuce", 4, "leaf")],
  instructions: ["Mash the drained beans, leaving some texture.",
    "Mix in sautéed onion and garlic, breadcrumbs, egg and spices; season well.",
    "Shape into four patties and chill 10 minutes to firm up.",
    "Pan-fry in oil until crisp on both sides, about 4 minutes a side.",
    "Serve in toasted buns with lettuce and your favourite sauce."] });

add({ id: "lemon-herb-roast-chicken-traybake", name: "Lemon Herb Chicken Traybake",
  description: "Chicken pieces roasted with lemon, potatoes and herbs in one tray.",
  cuisine: "mediterranean", cook_time: 50, calories_per_serving: 520, primary_protein: "chicken", is_dairy_free: true, is_gluten_free: true, ease_score: 0.85,
  ingredients: [M("Chicken thighs and drumsticks", 8), V("Potatoes", 700, "g"), V("Lemon", 2), V("Garlic", 6, "clove"),
    P("Olive oil", 4, "tbsp"), P("Dried oregano", 1, "tbsp"), V("Red onion", 1), V("Rosemary", 2, "sprig")],
  instructions: ["Toss chunked potatoes, onion and garlic with oil and oregano in a large tray.",
    "Sit the chicken on top and squeeze over the lemon, tucking in the spent halves and rosemary.",
    "Season everything well and drizzle with more oil.",
    "Roast at 200C for 45 minutes until the chicken is golden and the potatoes are tender.",
    "Rest 5 minutes and serve with the pan juices."] });

add({ id: "thai-coconut-chicken-soup", name: "Tom Kha Gai (Thai Coconut Chicken Soup)",
  description: "Fragrant coconut soup with chicken, mushrooms, lemongrass and lime.",
  cuisine: "asian", cook_time: 25, calories_per_serving: 340, primary_protein: "chicken",
  is_dairy_free: true, is_gluten_free: true, cost_tier: 2, ease_score: 0.75, is_one_pot: true,
  ingredients: [M("Chicken thighs, sliced", 400, "g"), D("Coconut milk", 1, "can"), V("Mushrooms", 200, "g"),
    V("Lemongrass", 2, "stalk"), V("Ginger", 1, "tbsp"), P("Fish sauce", 2, "tbsp"), V("Lime", 2), V("Cilantro", 0.5, "cup"), P("Chicken stock", 2, "cup")],
  instructions: ["Bring the stock with bruised lemongrass and sliced ginger to a simmer for 5 minutes.",
    "Add the chicken and mushrooms and simmer 8 minutes.",
    "Pour in the coconut milk and fish sauce and warm through without boiling hard.",
    "Take off the heat and add lime juice to taste.",
    "Ladle into bowls and finish with cilantro and chilli if you like."] });

add({ id: "baked-feta-pasta", name: "Baked Feta & Tomato Pasta",
  description: "Whole feta baked with cherry tomatoes, then mashed into a creamy pasta sauce.",
  cuisine: "mediterranean", cook_time: 35, calories_per_serving: 460, primary_protein: "none",
  is_vegetarian: true, contains_dairy: true, cost_tier: 1, ease_score: 0.9,
  ingredients: [D("Feta", 200, "g"), V("Cherry tomatoes", 500, "g"), V("Garlic", 3, "clove"), P("Penne", 400, "g"),
    P("Olive oil", 4, "tbsp"), P("Chilli flakes", 0.5, "tsp"), V("Basil", 0.5, "cup")],
  instructions: ["Put the tomatoes and garlic in a baking dish with a block of feta in the centre.",
    "Drizzle generously with oil, add chilli, and bake at 200C for 30 minutes until the tomatoes burst.",
    "Cook the penne until al dente, reserving some water.",
    "Mash the roasted feta and tomatoes into a sauce.",
    "Toss with the pasta and a splash of water, then fold through basil."] });

add({ id: "chicken-shawarma-bowls", name: "Chicken Shawarma Bowls",
  description: "Spiced roasted chicken over rice with salad and garlic yogurt.",
  cuisine: "middle-eastern", cook_time: 30, calories_per_serving: 500, primary_protein: "chicken", contains_dairy: true, is_gluten_free: true, ease_score: 0.8,
  ingredients: [M("Chicken thighs, sliced", 600, "g"), P("Cumin", 1, "tsp"), P("Smoked paprika", 1, "tbsp"),
    P("Turmeric", 0.5, "tsp"), D("Yogurt", 0.5, "cup"), V("Garlic", 2, "clove"), P("Cooked rice", 4, "cup"),
    V("Tomatoes", 2), V("Cucumber", 1), V("Lemon", 1)],
  instructions: ["Toss the chicken with the spices, lemon and oil and marinate 20 minutes.",
    "Roast at 220C for 20 minutes until charred at the edges.",
    "Mix the yogurt with grated garlic and lemon for the sauce.",
    "Make a quick chopped salad of tomato and cucumber.",
    "Build bowls of rice, chicken and salad, drizzled with the garlic yogurt."] });

add({ id: "minestrone", name: "Classic Minestrone",
  description: "Italian vegetable and bean soup with pasta and tomato.",
  cuisine: "italian", cook_time: 35, calories_per_serving: 300, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, cost_tier: 1, ease_score: 0.85, is_one_pot: true,
  ingredients: [V("Onion", 1), V("Carrots", 2), V("Celery", 2, "stalk"), V("Courgette", 1), V("Garlic", 3, "clove"),
    P("Canned tomatoes", 1, "can"), P("Cannellini beans", 1, "can"), P("Small pasta", 1, "cup"), P("Vegetable stock", 5, "cup"), V("Basil", 0.25, "cup")],
  instructions: ["Soften the onion, carrot, celery and garlic in olive oil.",
    "Add the tomatoes and stock and simmer 15 minutes.",
    "Add the courgette and beans and cook 5 minutes.",
    "Stir in the pasta and cook until tender.",
    "Season and finish with basil and grated parmesan if you like."] });

add({ id: "teriyaki-salmon-bowls", name: "Teriyaki Salmon Bowls",
  description: "Glazed salmon over rice with quick-pickled cucumber and edamame.",
  cuisine: "asian", cook_time: 20, calories_per_serving: 470, primary_protein: "fish",
  is_pescatarian: true, is_dairy_free: true, cost_tier: 3, ease_score: 0.8,
  ingredients: [F("Salmon fillets", 4), P("Soy sauce", 3, "tbsp"), P("Mirin", 2, "tbsp"), P("Honey", 1, "tbsp"),
    V("Cucumber", 1), P("Rice vinegar", 2, "tbsp"), P("Edamame", 1, "cup"), P("Cooked rice", 4, "cup"), P("Sesame seeds", 1, "tbsp")],
  instructions: ["Simmer the soy, mirin and honey into a teriyaki glaze.",
    "Sear the salmon, then spoon over the glaze and let it lacquer the fish.",
    "Quick-pickle sliced cucumber in the vinegar with a pinch of salt.",
    "Warm the edamame.",
    "Build bowls of rice, salmon, cucumber and edamame; sprinkle with sesame."] });

add({ id: "vegetarian-chili", name: "Three-Bean Vegetarian Chili",
  description: "Hearty smoky chili with three beans, peppers and corn.",
  cuisine: "mexican", cook_time: 40, calories_per_serving: 360, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, is_dairy_free: true, is_gluten_free: true, cost_tier: 1, ease_score: 0.85, is_one_pot: true,
  ingredients: [P("Mixed beans", 3, "can"), V("Onion", 1), V("Bell peppers", 2), V("Garlic", 4, "clove"),
    P("Canned tomatoes", 1, "can"), P("Cumin", 1, "tbsp"), P("Smoked paprika", 1, "tbsp"), P("Sweetcorn", 1, "can"), P("Cocoa powder", 1, "tsp")],
  instructions: ["Soften the onion, peppers and garlic.",
    "Add the cumin, paprika and cocoa and toast for a minute.",
    "Add the tomatoes and a cup of water and simmer 10 minutes.",
    "Add the drained beans and corn and simmer 20 minutes until thick.",
    "Season well and serve with rice, or toppings like avocado and lime."] });

add({ id: "pork-stirfry-greens", name: "Pork & Greens Stir-Fry",
  description: "Quick pork mince stir-fry with garlic, ginger and leafy greens.",
  cuisine: "asian", cook_time: 15, calories_per_serving: 380, primary_protein: "pork", is_dairy_free: true, ease_score: 0.85, is_one_pot: true,
  ingredients: [M("Pork mince", 500, "g"), V("Pak choi or greens", 300, "g"), V("Garlic", 3, "clove"),
    V("Ginger", 1, "tbsp"), P("Soy sauce", 3, "tbsp"), P("Oyster sauce", 1, "tbsp"), V("Spring onions", 3), P("Cooked rice", 4, "cup")],
  instructions: ["Stir-fry the pork mince in a hot wok until browned and crisp in places.",
    "Add the garlic and ginger and toss for 30 seconds.",
    "Add the chopped greens and stir-fry until just wilted.",
    "Add the soy and oyster sauces to glaze.",
    "Finish with spring onions and serve over rice."] });

add({ id: "stuffed-aubergine-lamb", name: "Lamb-Stuffed Aubergines",
  description: "Roasted aubergine boats filled with spiced lamb and tomato.",
  cuisine: "middle-eastern", cook_time: 50, calories_per_serving: 420, primary_protein: "lamb", is_dairy_free: true, is_gluten_free: true, ease_score: 0.6,
  ingredients: [V("Aubergines", 2), M("Lamb mince", 400, "g"), V("Onion", 1), V("Garlic", 3, "clove"),
    P("Cumin", 1, "tsp"), P("Cinnamon", 0.5, "tsp"), P("Tomato paste", 2, "tbsp"), V("Parsley", 0.5, "cup"), P("Pine nuts", 0.25, "cup")],
  instructions: ["Halve the aubergines, score the flesh, brush with oil and roast at 200C for 20 minutes.",
    "Brown the lamb, then add onion, garlic and spices.",
    "Stir in the tomato paste and a splash of water to make a thick filling.",
    "Scoop a little flesh from the aubergines, fold it into the lamb, and pile the mixture back in.",
    "Top with pine nuts and roast 20 minutes more; finish with parsley."] });

add({ id: "spinach-ricotta-pasta-bake", name: "Spinach & Ricotta Pasta Bake",
  description: "Pasta folded with spinach, ricotta and tomato, baked under cheese.",
  cuisine: "italian", cook_time: 45, calories_per_serving: 480, primary_protein: "none",
  is_vegetarian: true, contains_dairy: true, cost_tier: 1, ease_score: 0.75,
  ingredients: [P("Rigatoni", 400, "g"), V("Spinach", 300, "g"), D("Ricotta", 250, "g"), P("Tomato passata", 2, "cup"),
    V("Garlic", 3, "clove"), D("Mozzarella", 150, "g"), P("Olive oil", 2, "tbsp"), V("Basil", 0.25, "cup")],
  instructions: ["Cook the pasta until just under al dente; drain.",
    "Make a quick tomato sauce with garlic and the passata.",
    "Wilt the spinach, then mix with the ricotta.",
    "Fold the pasta with the tomato sauce and dot through the spinach-ricotta.",
    "Top with mozzarella and bake at 190C for 25 minutes until golden and bubbling."] });

/* ===== write out ===== */
const PATH = "./seed/recipes.seed.json";
const existing = JSON.parse(readFileSync(PATH, "utf8"));
const haveIds = new Set(existing.map((x) => x.id));
const haveNames = new Set(existing.map((x) => x.name.toLowerCase()));
const fresh = R.filter((x) => !haveIds.has(x.id) && !haveNames.has(x.name.toLowerCase()));
const merged = existing.concat(fresh);
writeFileSync(PATH, JSON.stringify(merged, null, 2));
console.log(`authored ${R.length}, added ${fresh.length}. Total now ${merged.length}.`);
