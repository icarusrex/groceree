// Curated backfill batch v2. Hand-authored clean mains to replace the 186
// scraped "5 Ingredients" recipes that were dropped (truncated steps / title
// bleed). Every recipe here has complete instructions and categorised
// ingredients — no scraping, no truncation. Weighted toward the catalogue's
// gaps: Portuguese, Mediterranean, Asian, Indian/Middle-Eastern, more fish and
// vegetarian. Idempotent: dedupes by id. Run: node scripts/add_curated_recipes_v2.mjs
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "curated-v2";
const NORM = {
  cups: "cup", cup: "cup", tablespoons: "tbsp", tablespoon: "tbsp", tbsp: "tbsp",
  teaspoons: "tsp", teaspoon: "tsp", tsp: "tsp", cloves: "clove", clove: "clove",
  pounds: "lb", pound: "lb", lbs: "lb", lb: "lb", ounces: "oz", ounce: "oz", oz: "oz",
  can: "can", cans: "can", "": "", g: "g", ml: "ml", bunch: "bunch", inch: "inch",
  handful: "handful", sprig: "sprig", slice: "slice", slices: "slice",
};
const ing = (name, quantity, unit, category) => ({
  name, quantity, unit, unit_norm: NORM[unit] ?? unit, category,
});
const P = (n, q, u = "") => ing(n, q, u, "pantry");
const V = (n, q, u = "") => ing(n, q, u, "produce");
const M = (n, q, u = "") => ing(n, q, u, "meat");
const F = (n, q, u = "") => ing(n, q, u, "seafood");
const D = (n, q, u = "") => ing(n, q, u, "dairy");

const R = [];
const add = (r) => R.push({
  meal_type: "dinner",
  cuisine: null, difficulty: "easy", servings: 4, cost_tier: 2, ease_score: 0.6,
  is_gluten_free: false, is_vegetarian: false, is_pescatarian: false,
  is_dairy_free: false, contains_dairy: false, is_one_pot: false,
  primary_protein: "none", source: SOURCE,
  ...r,
  prep_time: r.prep_time ?? 10,
  total_time: r.total_time ?? (r.prep_time ?? 10) + (r.cook_time ?? 20),
  ingredient_count: r.ingredients.length,
});

/* ========================= PORTUGUESE ========================= */
add({ id: "bifanas", name: "Bifanas (Portuguese Pork Sandwiches)",
  description: "Thin pork steaks simmered in garlicky white-wine and paprika sauce, piled into crusty rolls.",
  cuisine: "portuguese", cook_time: 25, calories_per_serving: 480, primary_protein: "pork", cost_tier: 2, ease_score: 0.7,
  ingredients: [M("Thin pork loin steaks", 600, "g"), V("Garlic", 4, "clove"), P("White wine", 0.5, "cup"),
    P("Sweet paprika", 1, "tbsp"), P("Bay leaf", 2), P("Lard or olive oil", 2, "tbsp"), P("Crusty bread rolls", 4),
    P("Mustard", 2, "tbsp"), P("Piri-piri sauce", 1, "tsp")],
  instructions: ["Make a marinade of crushed garlic, white wine, paprika, bay leaves and salt; coat the pork and rest 30 minutes.",
    "Heat lard in a wide pan over high heat and sear the steaks 1 minute per side, working in batches.",
    "Pour in the marinade, lower the heat and simmer 10 minutes until the sauce reduces and the pork is tender.",
    "Split the rolls and brush the cut sides with a little sauce.",
    "Fill with pork, spoon over more sauce, and add mustard and piri-piri to taste."] });

add({ id: "caldeirada-de-peixe", name: "Caldeirada de Peixe (Portuguese Fish Stew)",
  description: "Layered Portuguese fisherman's stew of white fish, potatoes, peppers and tomato.",
  cuisine: "portuguese", cook_time: 40, calories_per_serving: 420, primary_protein: "fish",
  is_pescatarian: true, cost_tier: 3, ease_score: 0.55, is_one_pot: true,
  ingredients: [F("Firm white fish fillets", 700, "g"), V("Potatoes", 600, "g"), V("Onions", 2),
    V("Bell peppers", 2), V("Tomatoes", 3), V("Garlic", 3, "clove"), P("Olive oil", 4, "tbsp"),
    P("White wine", 0.5, "cup"), V("Parsley", 0.5, "cup"), P("Bay leaf", 1)],
  instructions: ["Slice potatoes, onions, peppers and tomatoes thinly.",
    "In a wide pot layer half the vegetables, season, then lay the fish on top and cover with the rest of the vegetables.",
    "Tuck in garlic and bay, drizzle generously with olive oil and pour in the white wine and a splash of water.",
    "Cover and bring to a gentle simmer; cook 30 minutes without stirring so the layers hold.",
    "Shake the pot occasionally instead of stirring; finish with parsley and serve in bowls with the broth."] });

add({ id: "bacalhau-com-natas", name: "Bacalhau com Natas (Salt Cod Gratin with Cream)",
  description: "Comforting Portuguese gratin of flaked salt cod, fried potatoes and onions baked in cream.",
  cuisine: "portuguese", cook_time: 45, calories_per_serving: 560, primary_protein: "fish",
  is_pescatarian: true, contains_dairy: true, cost_tier: 3, ease_score: 0.5,
  ingredients: [F("Salt cod, soaked and flaked", 500, "g"), V("Potatoes", 800, "g"), V("Onions", 2),
    V("Garlic", 2, "clove"), D("Heavy cream", 400, "ml"), P("Milk", 200, "ml"), P("Flour", 1, "tbsp"),
    P("Olive oil", 4, "tbsp"), D("Grated cheese", 50, "g"), P("Nutmeg", 0.25, "tsp")],
  instructions: ["Cut potatoes into small cubes and fry in olive oil until golden; drain.",
    "Soften sliced onions and garlic in the same pan, then add the flaked cod and warm through.",
    "Make a quick white sauce: whisk flour into a little oil, add milk then cream, season with nutmeg, salt and pepper.",
    "Fold the potatoes, cod and onions into most of the sauce and spread in a baking dish.",
    "Top with the remaining cream and the cheese; bake at 200C for 20 minutes until bubbling and golden."] });

add({ id: "feijoada-transmontana", name: "Feijoada à Transmontana (Portuguese Bean & Pork Stew)",
  description: "Hearty northern-Portuguese stew of white beans with pork, chouriço and smoked meats.",
  cuisine: "portuguese", cook_time: 90, calories_per_serving: 620, primary_protein: "pork", cost_tier: 2, ease_score: 0.5, is_one_pot: true,
  ingredients: [M("Pork shoulder, cubed", 500, "g"), M("Chouriço sausage", 200, "g"), M("Smoked bacon", 150, "g"),
    P("White beans", 2, "can"), V("Onions", 2), V("Carrots", 2), V("Garlic", 4, "clove"),
    P("Tomato paste", 2, "tbsp"), P("Sweet paprika", 1, "tbsp"), P("Bay leaf", 2)],
  instructions: ["Brown the pork shoulder in a heavy pot, then add sliced chouriço and bacon and render briefly.",
    "Add chopped onion, carrot and garlic and cook until soft.",
    "Stir in tomato paste and paprika, cook 1 minute, then add bay leaves and water to cover.",
    "Simmer covered 1 hour until the pork is tender.",
    "Add the drained beans and simmer 20 minutes more to thicken; season and serve with rice."] });

add({ id: "polvo-a-lagareiro", name: "Polvo à Lagareiro (Roasted Octopus with Smashed Potatoes)",
  description: "Tender octopus roasted with garlic and olive oil over crushed baby potatoes.",
  cuisine: "portuguese", cook_time: 75, calories_per_serving: 450, primary_protein: "fish",
  is_pescatarian: true, cost_tier: 4, ease_score: 0.45,
  ingredients: [F("Octopus", 1, ""), V("Baby potatoes", 800, "g"), V("Garlic", 6, "clove"),
    P("Olive oil", 0.5, "cup"), V("Onion", 1), P("Bay leaf", 2), V("Parsley", 0.5, "cup"), P("Coarse salt", 1, "tsp")],
  instructions: ["Simmer the octopus with an onion and bay leaves for 45 minutes until a knife slips into the thickest part.",
    "Boil the baby potatoes until tender, then lightly crush each one.",
    "Arrange octopus and potatoes in a roasting tray, scatter sliced garlic over the top.",
    "Drench everything in olive oil and season with coarse salt.",
    "Roast at 220C for 20 minutes until the edges crisp; shower with parsley before serving."] });

add({ id: "rojoes-a-minhota", name: "Rojões à Minhota (Marinated Fried Pork)",
  description: "Cubes of pork marinated in white wine and garlic, fried until crisp and golden.",
  cuisine: "portuguese", cook_time: 40, calories_per_serving: 520, primary_protein: "pork", cost_tier: 2, ease_score: 0.6,
  ingredients: [M("Pork shoulder, cubed", 800, "g"), P("White wine", 1, "cup"), V("Garlic", 5, "clove"),
    P("Sweet paprika", 1, "tbsp"), P("Bay leaf", 2), P("Lard or olive oil", 3, "tbsp"), V("Lemon", 1), V("Potatoes", 500, "g")],
  instructions: ["Marinate the pork overnight in white wine, crushed garlic, paprika, bay and salt.",
    "Drain the pork, reserving the marinade, and fry in hot lard until browned on all sides.",
    "Pour in the reserved marinade and simmer until the liquid evaporates and the pork glazes.",
    "Fry cubed potatoes separately until golden.",
    "Toss the pork with the potatoes and a squeeze of lemon; serve hot."] });

add({ id: "jardineira", name: "Jardineira (Portuguese Beef & Vegetable Stew)",
  description: "Homely Portuguese braise of beef with potatoes, carrots, peas and green beans.",
  cuisine: "portuguese", cook_time: 70, calories_per_serving: 430, primary_protein: "beef", cost_tier: 2, ease_score: 0.6, is_one_pot: true,
  ingredients: [M("Stewing beef, cubed", 600, "g"), V("Potatoes", 500, "g"), V("Carrots", 3),
    V("Green beans", 200, "g"), P("Frozen peas", 1, "cup"), V("Onion", 1), V("Garlic", 3, "clove"),
    P("Tomato paste", 2, "tbsp"), P("White wine", 0.5, "cup"), P("Bay leaf", 1)],
  instructions: ["Brown the beef in a pot, then remove and soften chopped onion and garlic.",
    "Stir in tomato paste, return the beef, add wine and bay and water to cover; simmer 45 minutes.",
    "Add chunked potatoes and carrots and cook 15 minutes.",
    "Add the green beans and peas and simmer 10 minutes more until everything is tender.",
    "Season well and rest 5 minutes before serving."] });

add({ id: "acorda-de-gambas", name: "Açorda de Gambas (Garlic Bread & Prawn Porridge)",
  description: "Rustic Alentejo bread stew loosened with stock, garlic, coriander and prawns, bound with egg.",
  cuisine: "portuguese", cook_time: 25, calories_per_serving: 410, primary_protein: "fish",
  is_pescatarian: true, cost_tier: 3, ease_score: 0.5,
  ingredients: [F("Prawns, peeled", 400, "g"), P("Stale rustic bread", 300, "g"), V("Garlic", 5, "clove"),
    V("Coriander", 1, "bunch"), P("Olive oil", 4, "tbsp"), D("Eggs", 3), P("Fish or prawn stock", 3, "cup"), P("Piri-piri", 0.5, "tsp")],
  instructions: ["Make a quick stock by simmering the prawn shells; strain.",
    "Pound garlic, coriander and salt into a paste and loosen with olive oil in a wide pot.",
    "Tear the bread into the pot and pour over the hot stock; stir to a soft porridge.",
    "Stir in the prawns and cook 3 minutes until just pink.",
    "Beat in the eggs off the heat so they thicken without scrambling; finish with piri-piri and extra coriander."] });

add({ id: "peru-de-cebolada", name: "Peru de Cebolada (Turkey in Onion Sauce)",
  description: "Turkey steaks braised slowly in a sweet tomato and onion sauce.",
  cuisine: "portuguese", cook_time: 40, calories_per_serving: 360, primary_protein: "turkey", cost_tier: 2, ease_score: 0.7, is_one_pot: true,
  ingredients: [M("Turkey breast steaks", 600, "g"), V("Onions", 3), V("Tomatoes", 3), V("Garlic", 3, "clove"),
    P("Olive oil", 3, "tbsp"), P("White wine", 0.5, "cup"), P("Bay leaf", 1), P("Sweet paprika", 1, "tsp"), V("Parsley", 0.25, "cup")],
  instructions: ["Season the turkey and brown in olive oil; set aside.",
    "Cook thinly sliced onions slowly in the same pan until soft and golden, about 12 minutes.",
    "Add garlic, chopped tomatoes, paprika and bay; cook to a jammy sauce.",
    "Return the turkey with the wine, cover and braise 15 minutes until tender.",
    "Scatter with parsley and serve with rice or potatoes."] });

add({ id: "ervilhas-com-ovos", name: "Ervilhas com Ovos (Peas with Eggs & Chouriço)",
  description: "Quick Portuguese braise of peas with onion, chouriço and eggs poached on top.",
  cuisine: "portuguese", cook_time: 25, calories_per_serving: 340, primary_protein: "pork", cost_tier: 1, ease_score: 0.8, is_one_pot: true,
  ingredients: [P("Frozen peas", 3, "cup"), M("Chouriço sausage", 120, "g"), V("Onion", 1), V("Garlic", 2, "clove"),
    V("Tomatoes", 2), P("Olive oil", 2, "tbsp"), D("Eggs", 4), V("Coriander", 0.25, "cup"), P("Bay leaf", 1)],
  instructions: ["Soften chopped onion and garlic in olive oil, then add sliced chouriço to render.",
    "Add chopped tomatoes and bay and cook to a light sauce.",
    "Tip in the peas with a splash of water and simmer 8 minutes.",
    "Make four wells and crack in the eggs; cover and cook until the whites set.",
    "Finish with coriander and serve with crusty bread."] });

add({ id: "bitoque", name: "Bitoque (Portuguese Steak with Egg)",
  description: "Pan-fried beef steak in garlic-wine sauce topped with a fried egg, with chips and rice.",
  cuisine: "portuguese", cook_time: 25, calories_per_serving: 620, primary_protein: "beef", cost_tier: 3, ease_score: 0.7,
  ingredients: [M("Beef sirloin steaks", 4), V("Garlic", 4, "clove"), P("White wine", 0.5, "cup"),
    P("Butter", 2, "tbsp"), D("Eggs", 4), V("Potatoes", 600, "g"), P("Olive oil", 3, "tbsp"), P("Bay leaf", 1), P("Mustard", 1, "tsp")],
  instructions: ["Fry chipped potatoes until golden and keep warm.",
    "Season the steaks and sear in olive oil to your liking; rest on a plate.",
    "Add garlic, bay, mustard and white wine to the pan and reduce, then swirl in the butter for a glossy sauce.",
    "Fry the eggs in a separate pan with crisp edges.",
    "Plate each steak topped with an egg, sauce spooned over, chips and rice alongside."] });

add({ id: "migas-alentejanas", name: "Migas Alentejanas (Garlic Bread & Pork)",
  description: "Alentejo bread migas fried with garlic and paprika, served with crisp pork.",
  cuisine: "portuguese", cook_time: 35, calories_per_serving: 540, primary_protein: "pork", cost_tier: 2, ease_score: 0.55,
  ingredients: [M("Pork belly or shoulder, cubed", 500, "g"), P("Stale bread", 400, "g"), V("Garlic", 6, "clove"),
    P("Sweet paprika", 1, "tbsp"), P("Olive oil", 4, "tbsp"), P("Bay leaf", 1), P("White wine", 0.25, "cup"), V("Parsley", 0.25, "cup")],
  instructions: ["Marinate the pork in garlic, paprika, wine and salt for an hour, then fry until crisp; remove.",
    "Soak torn bread briefly in warm water and squeeze out most of the liquid.",
    "Fry sliced garlic in the pork fat and oil, add paprika, then the bread.",
    "Stir over medium heat until the bread comes together into a soft golden mass.",
    "Pile the migas with the crisp pork on top and scatter parsley."] });

/* ========================= MEDITERRANEAN / SPANISH / GREEK ========================= */
add({ id: "spanish-garlic-shrimp", name: "Gambas al Ajillo (Spanish Garlic Shrimp)",
  description: "Sizzling shrimp in garlic, chilli and olive oil — a 15-minute tapa main.",
  cuisine: "mediterranean", cook_time: 10, calories_per_serving: 280, primary_protein: "fish",
  is_pescatarian: true, is_gluten_free: true, cost_tier: 3, ease_score: 0.85,
  ingredients: [F("Large shrimp, peeled", 500, "g"), V("Garlic", 6, "clove"), P("Dried chilli flakes", 1, "tsp"),
    P("Olive oil", 0.5, "cup"), P("Sweet paprika", 1, "tsp"), V("Parsley", 0.25, "cup"), V("Lemon", 1)],
  instructions: ["Warm the olive oil with sliced garlic and chilli flakes over medium heat until the garlic is fragrant.",
    "Turn the heat up, add the shrimp and paprika and cook 2 minutes per side until pink.",
    "Squeeze in lemon and toss.",
    "Off the heat, stir through the parsley.",
    "Serve immediately with crusty bread to mop the oil."] });

add({ id: "spanish-chickpea-spinach-stew", name: "Garbanzos con Espinacas (Spanish Chickpea & Spinach Stew)",
  description: "Smoky Andalusian stew of chickpeas and spinach thickened with fried bread and garlic.",
  cuisine: "mediterranean", cook_time: 30, calories_per_serving: 360, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, is_dairy_free: true, cost_tier: 1, ease_score: 0.75, is_one_pot: true,
  ingredients: [P("Chickpeas", 2, "can"), V("Baby spinach", 300, "g"), V("Garlic", 4, "clove"),
    P("Smoked paprika", 1, "tbsp"), P("Cumin", 1, "tsp"), P("Bread slice", 1), P("Tomato paste", 1, "tbsp"),
    P("Olive oil", 3, "tbsp"), P("Sherry vinegar", 1, "tbsp")],
  instructions: ["Fry the bread slice and garlic in olive oil until golden, then blend with the cumin and a splash of water to a paste.",
    "In the same pan cook tomato paste and smoked paprika for a minute.",
    "Add the drained chickpeas and a cup of water and simmer 10 minutes.",
    "Stir in the bread paste to thicken, then wilt in the spinach.",
    "Finish with sherry vinegar, salt and a drizzle of olive oil."] });

add({ id: "greek-baked-fish-plaki", name: "Psari Plaki (Greek Baked Fish with Tomato)",
  description: "White fish baked over onions, tomato and herbs with lemon and olive oil.",
  cuisine: "mediterranean", cook_time: 35, calories_per_serving: 330, primary_protein: "fish",
  is_pescatarian: true, is_gluten_free: true, cost_tier: 3, ease_score: 0.7,
  ingredients: [F("White fish fillets", 700, "g"), V("Onions", 2), V("Tomatoes", 4), V("Garlic", 3, "clove"),
    P("Olive oil", 4, "tbsp"), V("Lemon", 1), V("Parsley", 0.5, "cup"), P("Dried oregano", 1, "tsp")],
  instructions: ["Soften sliced onions and garlic in olive oil until sweet.",
    "Add chopped tomatoes and oregano and cook to a loose sauce.",
    "Spread the sauce in a baking dish and nestle the fish on top.",
    "Drizzle with olive oil and lemon, season, and bake at 190C for 20 minutes.",
    "Scatter with parsley and serve with bread or rice."] });

add({ id: "briam-greek-roast-veg", name: "Briam (Greek Roasted Vegetables)",
  description: "Slow-roasted Greek tray of courgette, potato, tomato and onion in olive oil.",
  cuisine: "mediterranean", cook_time: 60, calories_per_serving: 290, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, is_dairy_free: true, is_gluten_free: true, cost_tier: 1, ease_score: 0.8,
  ingredients: [V("Potatoes", 500, "g"), V("Courgettes", 2), V("Tomatoes", 4), V("Onions", 2),
    V("Garlic", 4, "clove"), P("Olive oil", 0.5, "cup"), V("Parsley", 0.5, "cup"), P("Dried oregano", 1, "tbsp")],
  instructions: ["Slice all the vegetables into thin rounds.",
    "Toss everything with the garlic, olive oil, oregano, salt and pepper in a large roasting tray.",
    "Spread out evenly and add a splash of water.",
    "Roast at 200C for 50 minutes, turning once, until soft and caramelised at the edges.",
    "Finish with parsley and serve warm with feta and bread."] });

add({ id: "spanish-lentil-chorizo-stew", name: "Lentejas con Chorizo (Spanish Lentil & Chorizo Stew)",
  description: "Earthy Spanish lentils stewed with chorizo, peppers and smoked paprika.",
  cuisine: "mediterranean", cook_time: 45, calories_per_serving: 410, primary_protein: "pork", cost_tier: 1, ease_score: 0.75, is_one_pot: true,
  ingredients: [P("Brown lentils", 1.5, "cup"), M("Chorizo", 200, "g"), V("Onion", 1), V("Carrots", 2),
    V("Bell pepper", 1), V("Garlic", 3, "clove"), P("Smoked paprika", 1, "tbsp"), P("Tomato paste", 2, "tbsp"), P("Bay leaf", 1)],
  instructions: ["Render sliced chorizo in a pot until the oil turns red, then remove.",
    "Soften chopped onion, carrot, pepper and garlic in that oil.",
    "Stir in tomato paste and smoked paprika, then add lentils, bay and water to cover.",
    "Simmer 30 minutes until the lentils are tender, adding water as needed.",
    "Return the chorizo, season and rest before serving."] });

add({ id: "turkish-eggs-cilbir", name: "Çılbır (Turkish Poached Eggs with Yogurt)",
  description: "Poached eggs over garlicky yogurt with chilli butter — a fast brunch-for-dinner.",
  cuisine: "mediterranean", cook_time: 15, calories_per_serving: 320, primary_protein: "none",
  is_vegetarian: true, is_gluten_free: true, contains_dairy: true, cost_tier: 1, ease_score: 0.7,
  ingredients: [D("Eggs", 4), D("Thick yogurt", 1.5, "cup"), V("Garlic", 1, "clove"), P("Butter", 3, "tbsp"),
    P("Aleppo or chilli flakes", 1, "tsp"), P("Paprika", 0.5, "tsp"), V("Dill", 0.25, "cup"), P("White vinegar", 1, "tbsp")],
  instructions: ["Stir grated garlic and salt into the yogurt and spread on plates.",
    "Bring a pot of water with the vinegar to a bare simmer and poach the eggs 3 minutes.",
    "Melt the butter with the chilli flakes and paprika until foaming and red.",
    "Sit the drained eggs on the yogurt.",
    "Spoon the chilli butter over and scatter with dill; serve with bread."] });

add({ id: "italian-tuna-bean-salad", name: "Tuscan Tuna & White Bean Salad",
  description: "No-cook Tuscan main of tuna, cannellini beans, red onion and lemon.",
  cuisine: "mediterranean", cook_time: 0, prep_time: 12, calories_per_serving: 340, primary_protein: "fish",
  is_pescatarian: true, is_gluten_free: true, is_dairy_free: true, cost_tier: 2, ease_score: 0.95,
  ingredients: [F("Canned tuna in oil", 2, "can"), P("Cannellini beans", 2, "can"), V("Red onion", 1),
    V("Cherry tomatoes", 1, "cup"), V("Parsley", 0.5, "cup"), V("Lemon", 1), P("Olive oil", 3, "tbsp"), P("Capers", 2, "tbsp")],
  instructions: ["Drain and rinse the beans and tip into a bowl.",
    "Add the flaked tuna, thinly sliced red onion, halved tomatoes and capers.",
    "Dress with olive oil, lemon juice, salt and pepper.",
    "Fold through the parsley.",
    "Let it sit 10 minutes for the flavours to mingle before serving."] });

/* ========================= ASIAN ========================= */
add({ id: "thai-basil-chicken", name: "Pad Krapow Gai (Thai Basil Chicken)",
  description: "Fiery 15-minute stir-fry of minced chicken with chilli, garlic and holy basil over rice.",
  cuisine: "asian", cook_time: 12, calories_per_serving: 420, primary_protein: "chicken", is_dairy_free: true, cost_tier: 2, ease_score: 0.85,
  ingredients: [M("Chicken mince", 500, "g"), V("Garlic", 5, "clove"), V("Thai chillies", 3),
    P("Soy sauce", 2, "tbsp"), P("Oyster sauce", 1, "tbsp"), P("Fish sauce", 1, "tbsp"), P("Sugar", 1, "tsp"),
    V("Thai basil", 2, "cup"), P("Cooked jasmine rice", 4, "cup"), P("Vegetable oil", 2, "tbsp")],
  instructions: ["Pound the garlic and chillies into a rough paste.",
    "Fry the paste in hot oil for 30 seconds until fragrant.",
    "Add the chicken mince and stir-fry on high heat, breaking it up, until cooked.",
    "Add soy, oyster and fish sauces and the sugar; toss to glaze.",
    "Kill the heat, fold in the basil until just wilted and serve over rice, ideally with a fried egg."] });

add({ id: "vietnamese-caramel-pork", name: "Thịt Kho (Vietnamese Caramel Pork)",
  description: "Pork belly braised in a sweet-savoury coconut caramel until meltingly tender.",
  cuisine: "asian", cook_time: 75, calories_per_serving: 520, primary_protein: "pork", is_dairy_free: true, cost_tier: 2, ease_score: 0.6, is_one_pot: true,
  ingredients: [M("Pork belly, cubed", 700, "g"), P("Sugar", 4, "tbsp"), P("Fish sauce", 3, "tbsp"),
    P("Coconut water", 2, "cup"), V("Shallots", 3), V("Garlic", 3, "clove"), D("Eggs", 4), P("Black pepper", 1, "tsp")],
  instructions: ["Melt the sugar in a pot to a deep amber caramel, then carefully add a splash of water.",
    "Add chopped shallots and garlic and the pork, tossing to coat in the caramel.",
    "Pour in the coconut water and fish sauce and bring to a simmer.",
    "Add peeled hard-boiled eggs, cover and braise gently 1 hour until the pork is tender.",
    "Uncover and reduce until glossy; finish with lots of black pepper and serve with rice."] });

add({ id: "japanese-chicken-katsu-curry", name: "Chicken Katsu Curry",
  description: "Crisp panko chicken over rice with a mild, glossy Japanese curry sauce.",
  cuisine: "asian", cook_time: 35, calories_per_serving: 640, primary_protein: "chicken", cost_tier: 2, ease_score: 0.6,
  ingredients: [M("Chicken breasts", 4), P("Panko breadcrumbs", 1.5, "cup"), P("Flour", 0.5, "cup"), D("Eggs", 2),
    V("Onion", 1), V("Carrot", 1), P("Curry powder", 2, "tbsp"), P("Flour", 2, "tbsp"), P("Chicken stock", 2, "cup"), P("Cooked rice", 4, "cup")],
  instructions: ["Soften chopped onion and carrot, stir in curry powder and flour, then whisk in stock to a smooth sauce; simmer 15 minutes and blend if you like it smooth.",
    "Flatten the chicken, then coat each piece in flour, beaten egg and panko.",
    "Shallow-fry until deep golden and cooked through, about 4 minutes per side.",
    "Slice the katsu.",
    "Serve over rice with the curry sauce poured alongside."] });

add({ id: "korean-beef-bulgogi", name: "Beef Bulgogi",
  description: "Thin marinated beef seared hot and sweet, served with rice and lettuce.",
  cuisine: "asian", cook_time: 15, calories_per_serving: 460, primary_protein: "beef", is_dairy_free: true, cost_tier: 3, ease_score: 0.75,
  ingredients: [M("Thinly sliced beef", 600, "g"), P("Soy sauce", 4, "tbsp"), V("Pear or apple", 1),
    V("Garlic", 4, "clove"), P("Sesame oil", 2, "tbsp"), P("Sugar", 2, "tbsp"), V("Spring onions", 4),
    P("Sesame seeds", 1, "tbsp"), P("Cooked rice", 4, "cup")],
  instructions: ["Blend soy, grated pear, garlic, sesame oil and sugar into a marinade.",
    "Toss the sliced beef in the marinade for at least 30 minutes.",
    "Sear the beef in batches in a screaming-hot pan so it caramelises rather than stews.",
    "Toss through sliced spring onions at the end.",
    "Sprinkle with sesame seeds and serve with rice and lettuce leaves for wrapping."] });

add({ id: "chinese-mapo-tofu", name: "Mapo Tofu",
  description: "Silken tofu and pork in a numbing, spicy Sichuan bean sauce.",
  cuisine: "asian", cook_time: 20, calories_per_serving: 380, primary_protein: "pork", is_dairy_free: true, cost_tier: 2, ease_score: 0.65,
  ingredients: [D("Silken tofu", 400, "g"), M("Pork mince", 200, "g"), P("Doubanjiang chilli bean paste", 2, "tbsp"),
    V("Garlic", 3, "clove"), V("Ginger", 1, "tbsp"), V("Spring onions", 3), P("Soy sauce", 1, "tbsp"),
    P("Sichuan peppercorns", 1, "tsp"), P("Cornstarch", 1, "tbsp"), P("Vegetable oil", 2, "tbsp")],
  instructions: ["Cube the tofu and warm it gently in salted water; drain.",
    "Fry the pork in oil until browned, then add the bean paste, garlic and ginger and cook until red and fragrant.",
    "Add a cup of water and soy and bring to a simmer.",
    "Slide in the tofu and simmer 5 minutes, then thicken with the cornstarch slurry.",
    "Finish with ground toasted Sichuan pepper and spring onions; serve over rice."] });

add({ id: "thai-green-curry-chicken", name: "Thai Green Curry with Chicken",
  description: "Fragrant coconut green curry with chicken, aubergine and basil.",
  cuisine: "asian", cook_time: 25, calories_per_serving: 480, primary_protein: "chicken",
  is_dairy_free: true, is_gluten_free: true, cost_tier: 2, ease_score: 0.75, is_one_pot: true,
  ingredients: [M("Chicken thighs, sliced", 600, "g"), P("Green curry paste", 3, "tbsp"), D("Coconut milk", 1, "can"),
    V("Aubergine", 1), V("Thai basil", 1, "cup"), P("Fish sauce", 2, "tbsp"), P("Sugar", 1, "tsp"),
    V("Lime", 1), V("Red chilli", 1)],
  instructions: ["Fry the curry paste in a few spoons of the thick coconut cream until it splits and smells fragrant.",
    "Add the chicken and brown briefly.",
    "Pour in the rest of the coconut milk, the fish sauce and sugar, then add chunked aubergine.",
    "Simmer 15 minutes until the chicken and aubergine are tender.",
    "Off the heat stir in basil and lime juice; top with sliced chilli and serve with rice."] });

add({ id: "vietnamese-lemongrass-chicken", name: "Vietnamese Lemongrass Chicken",
  description: "Caramelised lemongrass and chilli chicken thighs, bright with fish sauce and lime.",
  cuisine: "asian", cook_time: 20, calories_per_serving: 410, primary_protein: "chicken", is_dairy_free: true, cost_tier: 2, ease_score: 0.8,
  ingredients: [M("Chicken thighs, sliced", 600, "g"), V("Lemongrass", 2, "stalk"), V("Garlic", 3, "clove"),
    V("Shallots", 2), P("Fish sauce", 2, "tbsp"), P("Sugar", 1, "tbsp"), V("Red chilli", 1), V("Lime", 1), P("Vegetable oil", 2, "tbsp")],
  instructions: ["Mince the lemongrass, garlic and shallots into a paste.",
    "Marinate the chicken in half the paste with fish sauce and sugar for 20 minutes.",
    "Sear the chicken in hot oil until browned and nearly cooked.",
    "Add the rest of the aromatics and chilli and cook until everything caramelises.",
    "Squeeze over lime and serve with rice."] });

add({ id: "japanese-oyakodon", name: "Oyakodon (Chicken & Egg Rice Bowl)",
  description: "Chicken and onion simmered in dashi soy, set with beaten egg over rice.",
  cuisine: "asian", cook_time: 15, calories_per_serving: 440, primary_protein: "chicken", is_dairy_free: true, cost_tier: 1, ease_score: 0.8,
  ingredients: [M("Chicken thighs, sliced", 400, "g"), V("Onion", 1), D("Eggs", 4), P("Soy sauce", 3, "tbsp"),
    P("Mirin", 2, "tbsp"), P("Dashi or chicken stock", 1, "cup"), P("Sugar", 1, "tsp"), V("Spring onions", 2), P("Cooked rice", 4, "cup")],
  instructions: ["Simmer sliced onion in the dashi, soy, mirin and sugar in a wide pan for 3 minutes.",
    "Add the chicken and cook until just done.",
    "Pour the beaten eggs over in a swirl and cover.",
    "Cook 1 to 2 minutes until the egg is just set but still soft.",
    "Slide over bowls of hot rice and top with spring onion."] });

add({ id: "chinese-kung-pao-chicken", name: "Kung Pao Chicken",
  description: "Spicy stir-fried chicken with peanuts, dried chilli and a tangy soy sauce.",
  cuisine: "asian", cook_time: 18, calories_per_serving: 450, primary_protein: "chicken", is_dairy_free: true, cost_tier: 2, ease_score: 0.7,
  ingredients: [M("Chicken thighs, cubed", 500, "g"), P("Roasted peanuts", 0.5, "cup"), P("Dried red chillies", 6),
    V("Garlic", 3, "clove"), V("Ginger", 1, "tbsp"), V("Spring onions", 3), P("Soy sauce", 3, "tbsp"),
    P("Black vinegar", 1, "tbsp"), P("Sugar", 1, "tbsp"), P("Cornstarch", 1, "tbsp")],
  instructions: ["Toss the chicken with a little soy and cornstarch.",
    "Mix the sauce: remaining soy, vinegar, sugar and a splash of water.",
    "Stir-fry the chicken in hot oil until golden, then push aside and fry the chillies, garlic and ginger.",
    "Add the sauce and let it thicken around the chicken.",
    "Toss in peanuts and spring onions and serve with rice."] });

add({ id: "filipino-chicken-adobo", name: "Chicken Adobo",
  description: "Filipino chicken braised in soy, vinegar, garlic and bay until glossy.",
  cuisine: "asian", cook_time: 40, calories_per_serving: 430, primary_protein: "chicken",
  is_dairy_free: true, is_gluten_free: false, cost_tier: 1, ease_score: 0.85, is_one_pot: true,
  ingredients: [M("Chicken thighs", 8), P("Soy sauce", 0.5, "cup"), P("White vinegar", 0.33, "cup"),
    V("Garlic", 8, "clove"), P("Bay leaf", 3), P("Black peppercorns", 1, "tsp"), P("Sugar", 1, "tsp"), P("Cooked rice", 4, "cup")],
  instructions: ["Brown the chicken thighs skin-side down in a pot; remove.",
    "Fry the smashed garlic until golden.",
    "Return the chicken with soy, vinegar, bay, peppercorns and sugar; do not stir yet so the vinegar mellows.",
    "Simmer covered 25 minutes, then uncover and reduce until the sauce is glossy.",
    "Serve over rice with plenty of sauce."] });

add({ id: "singapore-noodles", name: "Singapore Noodles",
  description: "Curried rice vermicelli stir-fried with prawns, egg and vegetables.",
  cuisine: "asian", cook_time: 20, calories_per_serving: 420, primary_protein: "fish", is_pescatarian: true, is_dairy_free: true, cost_tier: 2, ease_score: 0.65,
  ingredients: [P("Rice vermicelli", 250, "g"), F("Prawns, peeled", 250, "g"), D("Eggs", 2),
    V("Bell pepper", 1), V("Carrot", 1), V("Spring onions", 3), P("Curry powder", 1.5, "tbsp"),
    P("Soy sauce", 3, "tbsp"), V("Garlic", 2, "clove"), P("Vegetable oil", 2, "tbsp")],
  instructions: ["Soak the vermicelli in hot water until pliable, then drain.",
    "Scramble the eggs in oil and set aside.",
    "Stir-fry garlic, pepper and carrot, then add the prawns until pink.",
    "Add the curry powder and toss, then the noodles, soy and a splash of water.",
    "Return the egg, add spring onions and toss until everything is coated and hot."] });

add({ id: "thai-red-curry-prawns", name: "Thai Red Curry with Prawns",
  description: "Quick coconut red curry with prawns, peppers and bamboo shoots.",
  cuisine: "asian", cook_time: 18, calories_per_serving: 390, primary_protein: "fish",
  is_pescatarian: true, is_dairy_free: true, is_gluten_free: true, cost_tier: 3, ease_score: 0.8, is_one_pot: true,
  ingredients: [F("Prawns, peeled", 500, "g"), P("Red curry paste", 3, "tbsp"), D("Coconut milk", 1, "can"),
    V("Bell pepper", 1), P("Bamboo shoots", 1, "can"), P("Fish sauce", 2, "tbsp"), P("Sugar", 1, "tsp"), V("Lime", 1), V("Thai basil", 0.5, "cup")],
  instructions: ["Fry the curry paste in the thick coconut cream until fragrant.",
    "Add the rest of the coconut milk, fish sauce and sugar.",
    "Add sliced pepper and bamboo shoots and simmer 5 minutes.",
    "Add the prawns and cook 3 minutes until pink.",
    "Finish with lime juice and basil; serve with rice."] });

add({ id: "korean-bibimbap-bowl", name: "Vegetable Bibimbap Bowl",
  description: "Rice bowl topped with seasoned vegetables, a fried egg and gochujang sauce.",
  cuisine: "asian", cook_time: 30, calories_per_serving: 480, primary_protein: "none",
  is_vegetarian: true, is_dairy_free: true, cost_tier: 1, ease_score: 0.6,
  ingredients: [P("Cooked rice", 4, "cup"), V("Spinach", 200, "g"), V("Carrot", 2), V("Mushrooms", 200, "g"),
    V("Beansprouts", 1, "cup"), D("Eggs", 4), P("Gochujang", 3, "tbsp"), P("Sesame oil", 2, "tbsp"),
    P("Soy sauce", 2, "tbsp"), P("Sesame seeds", 1, "tbsp")],
  instructions: ["Cook each vegetable separately in a little sesame oil and soy, seasoning as you go.",
    "Blanch the spinach and beansprouts, then squeeze and dress with sesame.",
    "Fry the eggs with crisp edges.",
    "Loosen the gochujang with a little sesame oil and water for the sauce.",
    "Mound the rice in bowls, arrange the vegetables in sections, top with an egg and serve with the sauce."] });

/* ========================= INDIAN / MIDDLE-EASTERN ========================= */
add({ id: "butter-chicken", name: "Butter Chicken (Murgh Makhani)",
  description: "Yogurt-marinated chicken in a silky spiced tomato and cream sauce.",
  cuisine: "indian", cook_time: 40, calories_per_serving: 540, primary_protein: "chicken",
  is_gluten_free: true, contains_dairy: true, cost_tier: 2, ease_score: 0.65,
  ingredients: [M("Chicken thighs, cubed", 700, "g"), D("Yogurt", 0.5, "cup"), P("Garam masala", 2, "tbsp"),
    V("Garlic", 4, "clove"), V("Ginger", 1, "tbsp"), P("Tomato passata", 2, "cup"), D("Heavy cream", 0.5, "cup"),
    P("Butter", 3, "tbsp"), P("Chilli powder", 1, "tsp"), P("Sugar", 1, "tsp")],
  instructions: ["Marinate the chicken in yogurt, half the garam masala, garlic and ginger for 30 minutes.",
    "Sear the chicken in butter until browned; set aside.",
    "Add the rest of the spices to the pan, then the passata, and simmer 15 minutes.",
    "Stir in the cream and sugar and return the chicken to finish cooking.",
    "Simmer until glossy and serve with rice or naan."] });

add({ id: "palak-paneer", name: "Palak Paneer",
  description: "Cubes of paneer in a smooth, lightly spiced spinach sauce.",
  cuisine: "indian", cook_time: 30, calories_per_serving: 380, primary_protein: "none",
  is_vegetarian: true, is_gluten_free: true, contains_dairy: true, cost_tier: 2, ease_score: 0.65,
  ingredients: [D("Paneer", 300, "g"), V("Spinach", 400, "g"), V("Onion", 1), V("Garlic", 3, "clove"),
    V("Ginger", 1, "tbsp"), P("Garam masala", 1, "tbsp"), P("Cumin", 1, "tsp"), D("Cream", 0.25, "cup"),
    V("Green chilli", 1), P("Vegetable oil", 2, "tbsp")],
  instructions: ["Blanch the spinach briefly, then blend to a smooth purée.",
    "Fry cumin, then onion, garlic, ginger and chilli until soft.",
    "Add garam masala and cook 1 minute.",
    "Stir in the spinach purée and simmer 5 minutes, loosening with water.",
    "Fold in the paneer cubes and cream and warm through; serve with rice or roti."] });

add({ id: "chicken-tikka-masala", name: "Chicken Tikka Masala",
  description: "Charred spiced chicken in a creamy tomato curry sauce.",
  cuisine: "indian", cook_time: 40, calories_per_serving: 520, primary_protein: "chicken",
  is_gluten_free: true, contains_dairy: true, cost_tier: 2, ease_score: 0.6,
  ingredients: [M("Chicken breast, cubed", 700, "g"), D("Yogurt", 0.5, "cup"), P("Tikka or garam masala", 2, "tbsp"),
    V("Onion", 1), V("Garlic", 4, "clove"), V("Ginger", 1, "tbsp"), P("Tomato passata", 2, "cup"),
    D("Cream", 0.5, "cup"), P("Paprika", 1, "tsp"), V("Cilantro", 0.5, "cup")],
  instructions: ["Marinate the chicken in yogurt and half the spice for 30 minutes, then grill or sear until charred.",
    "Fry onion, garlic and ginger until soft, then add the remaining spice and paprika.",
    "Add the passata and simmer 10 minutes until thickened.",
    "Stir in the cream and the cooked chicken.",
    "Simmer 5 minutes and finish with chopped cilantro."] });

add({ id: "aloo-gobi", name: "Aloo Gobi (Potato & Cauliflower Curry)",
  description: "Dry-spiced potatoes and cauliflower with turmeric, cumin and ginger.",
  cuisine: "indian", cook_time: 30, calories_per_serving: 300, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, is_dairy_free: true, is_gluten_free: true, cost_tier: 1, ease_score: 0.75, is_one_pot: true,
  ingredients: [V("Potatoes", 500, "g"), V("Cauliflower", 1), V("Onion", 1), V("Garlic", 3, "clove"),
    V("Ginger", 1, "tbsp"), P("Turmeric", 1, "tsp"), P("Cumin seeds", 1, "tsp"), P("Garam masala", 1, "tbsp"),
    V("Tomatoes", 2), V("Cilantro", 0.5, "cup")],
  instructions: ["Toast cumin seeds in oil, then fry onion, garlic and ginger.",
    "Add turmeric and chopped tomatoes and cook to a paste.",
    "Add cubed potatoes and cauliflower florets and toss to coat.",
    "Cover and steam-fry 20 minutes, stirring occasionally, until tender.",
    "Sprinkle garam masala and cilantro and serve with roti or rice."] });

add({ id: "rajma-kidney-bean-curry", name: "Rajma (Kidney Bean Curry)",
  description: "North Indian kidney beans simmered in an onion-tomato masala.",
  cuisine: "indian", cook_time: 35, calories_per_serving: 360, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, is_dairy_free: true, is_gluten_free: true, cost_tier: 1, ease_score: 0.8, is_one_pot: true,
  ingredients: [P("Kidney beans", 2, "can"), V("Onions", 2), V("Garlic", 4, "clove"), V("Ginger", 1, "tbsp"),
    V("Tomatoes", 4), P("Garam masala", 1, "tbsp"), P("Cumin", 1, "tsp"), P("Chilli powder", 1, "tsp"), V("Cilantro", 0.5, "cup")],
  instructions: ["Fry cumin, then cook the onions until deep golden.",
    "Add garlic, ginger and chopped tomatoes and cook to a thick masala.",
    "Stir in the dry spices and cook 1 minute.",
    "Add the drained beans and a cup of water and simmer 20 minutes, mashing some beans to thicken.",
    "Finish with cilantro and serve with rice."] });

add({ id: "lamb-rogan-josh", name: "Lamb Rogan Josh",
  description: "Aromatic Kashmiri lamb braised with yogurt and warm spices.",
  cuisine: "indian", cook_time: 90, calories_per_serving: 520, primary_protein: "lamb",
  is_gluten_free: true, contains_dairy: true, cost_tier: 3, ease_score: 0.5, is_one_pot: true,
  ingredients: [M("Lamb shoulder, cubed", 800, "g"), V("Onions", 2), V("Garlic", 5, "clove"), V("Ginger", 1, "tbsp"),
    D("Yogurt", 0.5, "cup"), P("Garam masala", 2, "tbsp"), P("Paprika", 1, "tbsp"), P("Cumin", 1, "tsp"), P("Cardamom pods", 4)],
  instructions: ["Brown the lamb in batches in a heavy pot; set aside.",
    "Fry the onions until golden, then add garlic, ginger and whole spices.",
    "Stir in the ground spices, then the yogurt a spoon at a time so it doesn't split.",
    "Return the lamb with water to barely cover and braise gently 70 minutes.",
    "Uncover and reduce to a thick sauce; serve with rice."] });

add({ id: "egyptian-koshari", name: "Koshari (Egyptian Lentils, Rice & Pasta)",
  description: "Egypt's national dish: rice, lentils and macaroni under spiced tomato sauce and crispy onions.",
  cuisine: "middle-eastern", cook_time: 45, calories_per_serving: 470, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, is_dairy_free: true, cost_tier: 1, ease_score: 0.55,
  ingredients: [P("Brown lentils", 1, "cup"), P("Rice", 1, "cup"), P("Macaroni", 1, "cup"), V("Onions", 3),
    V("Garlic", 3, "clove"), P("Tomato passata", 2, "cup"), P("Cumin", 1, "tsp"), P("White vinegar", 2, "tbsp"), P("Chickpeas", 1, "can")],
  instructions: ["Boil the lentils until tender; cook the rice and the macaroni separately.",
    "Fry the sliced onions slowly until deep brown and crisp; drain.",
    "Make the sauce: fry garlic and cumin, add passata and vinegar, and simmer 10 minutes.",
    "Warm the chickpeas in a little sauce.",
    "Layer rice, lentils and macaroni, spoon over the tomato sauce and chickpeas, and crown with crispy onions."] });

add({ id: "moroccan-chickpea-tagine", name: "Moroccan Chickpea & Apricot Tagine",
  description: "Sweet-spiced chickpea and vegetable tagine with apricots over couscous.",
  cuisine: "middle-eastern", cook_time: 35, calories_per_serving: 390, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, is_dairy_free: true, cost_tier: 1, ease_score: 0.75, is_one_pot: true,
  ingredients: [P("Chickpeas", 2, "can"), V("Onion", 1), V("Carrots", 2), V("Sweet potato", 1),
    P("Dried apricots", 0.5, "cup"), P("Ras el hanout", 2, "tbsp"), V("Tomatoes", 2), P("Vegetable stock", 2, "cup"), P("Couscous", 1.5, "cup")],
  instructions: ["Soften the onion, then add ras el hanout and cook until fragrant.",
    "Add carrots, cubed sweet potato and chopped tomatoes.",
    "Add the chickpeas, apricots and stock and simmer 20 minutes until the vegetables are tender.",
    "Meanwhile steam the couscous.",
    "Adjust the seasoning and serve the tagine over the couscous."] });

add({ id: "lebanese-batata-harra", name: "Batata Harra with Fried Eggs",
  description: "Crispy Lebanese spiced potatoes with garlic, coriander and chilli, topped with eggs.",
  cuisine: "middle-eastern", cook_time: 30, calories_per_serving: 360, primary_protein: "none",
  is_vegetarian: true, is_dairy_free: true, is_gluten_free: true, cost_tier: 1, ease_score: 0.7,
  ingredients: [V("Potatoes", 700, "g"), V("Garlic", 5, "clove"), V("Cilantro", 1, "bunch"), P("Chilli flakes", 1, "tsp"),
    P("Olive oil", 4, "tbsp"), D("Eggs", 4), V("Lemon", 1), P("Coriander seeds", 1, "tsp")],
  instructions: ["Parboil cubed potatoes for 5 minutes, then drain and dry.",
    "Fry them in olive oil until crisp and golden.",
    "Add the garlic, chilli and crushed coriander seeds and toss for a minute.",
    "Stir through chopped cilantro and lemon juice.",
    "Fry the eggs and serve on top of the potatoes."] });

add({ id: "turkish-red-lentil-soup", name: "Mercimek Çorbası (Turkish Red Lentil Soup)",
  description: "Velvety red lentil soup with cumin and a chilli-butter drizzle.",
  cuisine: "middle-eastern", cook_time: 30, calories_per_serving: 280, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, is_gluten_free: true, contains_dairy: true, cost_tier: 1, ease_score: 0.85, is_one_pot: true,
  ingredients: [P("Red lentils", 1.5, "cup"), V("Onion", 1), V("Carrot", 1), V("Garlic", 2, "clove"),
    P("Cumin", 1, "tsp"), P("Tomato paste", 1, "tbsp"), P("Vegetable stock", 5, "cup"), P("Butter", 2, "tbsp"),
    P("Paprika", 1, "tsp"), V("Lemon", 1)],
  instructions: ["Soften onion, carrot and garlic, then stir in tomato paste and cumin.",
    "Add the rinsed lentils and stock and simmer 20 minutes until collapsing.",
    "Blend until completely smooth, loosening with water if needed.",
    "Melt the butter with the paprika until red and foaming.",
    "Ladle the soup, drizzle the chilli butter over and serve with lemon wedges and bread."] });

/* ========================= ITALIAN ========================= */
add({ id: "pasta-puttanesca", name: "Spaghetti alla Puttanesca",
  description: "Punchy tomato pasta with olives, capers, anchovy and chilli.",
  cuisine: "italian", cook_time: 20, calories_per_serving: 420, primary_protein: "fish",
  is_pescatarian: true, is_dairy_free: true, cost_tier: 1, ease_score: 0.85,
  ingredients: [P("Spaghetti", 400, "g"), F("Anchovy fillets", 4), V("Garlic", 3, "clove"),
    P("Canned tomatoes", 1, "can"), P("Black olives", 0.5, "cup"), P("Capers", 2, "tbsp"),
    P("Chilli flakes", 1, "tsp"), P("Olive oil", 3, "tbsp"), V("Parsley", 0.5, "cup")],
  instructions: ["Cook the spaghetti in well-salted water until al dente.",
    "Melt the anchovies into the olive oil with the garlic and chilli over low heat.",
    "Add the tomatoes, olives and capers and simmer 10 minutes.",
    "Toss the drained pasta through the sauce with a splash of pasta water.",
    "Finish with parsley and a drizzle of olive oil."] });

add({ id: "risotto-mushroom", name: "Mushroom Risotto",
  description: "Creamy arborio risotto with mushrooms, white wine and parmesan.",
  cuisine: "italian", cook_time: 35, calories_per_serving: 460, primary_protein: "none",
  is_vegetarian: true, is_gluten_free: true, contains_dairy: true, cost_tier: 2, ease_score: 0.55,
  ingredients: [P("Arborio rice", 1.5, "cup"), V("Mushrooms", 400, "g"), V("Onion", 1), V("Garlic", 2, "clove"),
    P("White wine", 0.5, "cup"), P("Vegetable stock", 5, "cup"), D("Parmesan", 0.5, "cup"), P("Butter", 3, "tbsp"), V("Parsley", 0.25, "cup")],
  instructions: ["Sauté the sliced mushrooms until browned; set aside.",
    "Soften the onion and garlic in butter, then toast the rice for a minute.",
    "Add the wine and let it absorb, then add hot stock a ladle at a time, stirring, for about 18 minutes.",
    "Stir in the mushrooms near the end.",
    "Off the heat beat in parmesan and butter; finish with parsley and serve."] });

add({ id: "pasta-e-fagioli", name: "Pasta e Fagioli",
  description: "Rustic Italian pasta and bean soup-stew with tomato and rosemary.",
  cuisine: "italian", cook_time: 30, calories_per_serving: 380, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, is_dairy_free: true, cost_tier: 1, ease_score: 0.8, is_one_pot: true,
  ingredients: [P("Cannellini beans", 2, "can"), P("Small pasta", 1.5, "cup"), V("Onion", 1), V("Carrot", 1),
    V("Celery", 2, "stalk"), V("Garlic", 3, "clove"), P("Tomato paste", 2, "tbsp"), P("Rosemary", 1, "sprig"), P("Vegetable stock", 4, "cup")],
  instructions: ["Soften the chopped onion, carrot, celery and garlic in olive oil.",
    "Stir in tomato paste and rosemary.",
    "Add the beans and stock and simmer 10 minutes, then mash some beans to thicken.",
    "Add the pasta and cook until tender, adding water if it gets too thick.",
    "Season well and serve with olive oil and grated cheese if you like."] });

add({ id: "chicken-cacciatore", name: "Chicken Cacciatore",
  description: "Braised chicken thighs with peppers, tomato, olives and herbs.",
  cuisine: "italian", cook_time: 45, calories_per_serving: 440, primary_protein: "chicken",
  is_dairy_free: true, is_gluten_free: true, cost_tier: 2, ease_score: 0.7, is_one_pot: true,
  ingredients: [M("Chicken thighs", 8), V("Onion", 1), V("Bell peppers", 2), V("Garlic", 3, "clove"),
    P("Canned tomatoes", 1, "can"), P("Black olives", 0.5, "cup"), P("White wine", 0.5, "cup"),
    P("Dried oregano", 1, "tsp"), V("Rosemary", 1, "sprig")],
  instructions: ["Brown the chicken thighs skin-side down until golden; remove.",
    "Soften the onion, peppers and garlic in the rendered fat.",
    "Add the wine and reduce, then the tomatoes, olives and herbs.",
    "Nestle the chicken back in, cover and simmer 30 minutes.",
    "Uncover for the last 10 minutes to thicken; serve with bread or polenta."] });

add({ id: "tuscan-sausage-bean-stew", name: "Tuscan Sausage & White Bean Stew",
  description: "Italian sausage braised with cannellini beans, kale and tomato.",
  cuisine: "italian", cook_time: 35, calories_per_serving: 480, primary_protein: "pork",
  is_dairy_free: true, is_gluten_free: true, cost_tier: 2, ease_score: 0.8, is_one_pot: true,
  ingredients: [M("Italian sausages", 6), P("Cannellini beans", 2, "can"), V("Kale", 200, "g"), V("Onion", 1),
    V("Garlic", 3, "clove"), P("Canned tomatoes", 1, "can"), P("Fennel seeds", 1, "tsp"), P("Chicken stock", 1, "cup")],
  instructions: ["Brown the sausages whole, then slice and set aside.",
    "Soften onion, garlic and fennel seeds in the same pot.",
    "Add tomatoes and stock and simmer 10 minutes.",
    "Add the beans and sausages and simmer 10 minutes more.",
    "Stir in the shredded kale until wilted; season and serve with bread."] });

add({ id: "pasta-alla-norma", name: "Pasta alla Norma",
  description: "Sicilian pasta with fried aubergine, tomato, basil and ricotta salata.",
  cuisine: "italian", cook_time: 30, calories_per_serving: 450, primary_protein: "none",
  is_vegetarian: true, contains_dairy: true, cost_tier: 1, ease_score: 0.75,
  ingredients: [P("Rigatoni", 400, "g"), V("Aubergines", 2), V("Garlic", 3, "clove"), P("Canned tomatoes", 1, "can"),
    V("Basil", 0.5, "cup"), D("Ricotta salata or feta", 100, "g"), P("Olive oil", 4, "tbsp"), P("Chilli flakes", 0.5, "tsp")],
  instructions: ["Fry cubed aubergine in olive oil until golden and soft; drain.",
    "Make a quick sauce with garlic, chilli and the tomatoes; simmer 12 minutes.",
    "Fold most of the aubergine into the sauce.",
    "Toss the cooked pasta through with a splash of pasta water.",
    "Top with the rest of the aubergine, torn basil and grated cheese."] });

/* ========================= MEXICAN / LATIN ========================= */
add({ id: "chicken-tinga-tacos", name: "Chicken Tinga Tacos",
  description: "Shredded chicken in smoky chipotle tomato sauce, piled into warm tortillas.",
  cuisine: "mexican", cook_time: 30, calories_per_serving: 410, primary_protein: "chicken",
  is_dairy_free: true, is_gluten_free: true, cost_tier: 2, ease_score: 0.8,
  ingredients: [M("Chicken thighs", 600, "g"), V("Onion", 1), V("Garlic", 3, "clove"), P("Canned tomatoes", 1, "can"),
    P("Chipotle in adobo", 2, "tbsp"), P("Cumin", 1, "tsp"), P("Corn tortillas", 12), V("Cilantro", 0.5, "cup"), V("Lime", 1)],
  instructions: ["Poach the chicken thighs until cooked, reserve the broth, then shred.",
    "Blend the tomatoes, chipotle, onion and garlic into a smooth sauce.",
    "Fry the sauce in a little oil until it deepens, then loosen with the broth.",
    "Fold in the shredded chicken and simmer 10 minutes.",
    "Warm the tortillas and fill, topping with cilantro, onion and lime."] });

add({ id: "black-bean-sweet-potato-enchiladas", name: "Black Bean & Sweet Potato Enchiladas",
  description: "Tortillas rolled around spiced sweet potato and black beans under red sauce and cheese.",
  cuisine: "mexican", cook_time: 45, calories_per_serving: 470, primary_protein: "none",
  is_vegetarian: true, contains_dairy: true, cost_tier: 1, ease_score: 0.65,
  ingredients: [V("Sweet potatoes", 2), P("Black beans", 2, "can"), P("Corn tortillas", 10),
    P("Enchilada or tomato sauce", 2, "cup"), D("Grated cheese", 1.5, "cup"), V("Onion", 1),
    P("Cumin", 1, "tsp"), P("Smoked paprika", 1, "tsp"), V("Cilantro", 0.5, "cup")],
  instructions: ["Roast cubed sweet potato until tender.",
    "Mash with the beans, sautéed onion, cumin and paprika into a chunky filling.",
    "Roll the filling in the tortillas and lay seam-down in a baking dish.",
    "Pour over the sauce and scatter with cheese.",
    "Bake at 190C for 20 minutes until bubbling; finish with cilantro."] });

add({ id: "carne-asada-bowls", name: "Carne Asada Bowls",
  description: "Citrus-marinated grilled steak sliced over rice with beans and salsa.",
  cuisine: "mexican", cook_time: 20, calories_per_serving: 520, primary_protein: "beef",
  is_dairy_free: true, is_gluten_free: true, cost_tier: 3, ease_score: 0.75,
  ingredients: [M("Flank or skirt steak", 600, "g"), V("Limes", 2), V("Orange", 1), V("Garlic", 4, "clove"),
    V("Cilantro", 1, "bunch"), P("Cumin", 1, "tsp"), P("Cooked rice", 4, "cup"), P("Black beans", 1, "can"), V("Tomatoes", 2)],
  instructions: ["Marinate the steak in lime, orange juice, garlic, cumin and half the cilantro for 30 minutes.",
    "Sear the steak hot and fast to medium-rare, then rest 5 minutes.",
    "Warm the beans and make a quick tomato salsa with the rest of the cilantro and lime.",
    "Slice the steak across the grain.",
    "Build bowls of rice, beans, steak and salsa."] });

add({ id: "mexican-tortilla-soup", name: "Mexican Tortilla Soup",
  description: "Brothy tomato-chilli soup with chicken, topped with crispy tortilla strips.",
  cuisine: "mexican", cook_time: 35, calories_per_serving: 360, primary_protein: "chicken",
  is_dairy_free: true, is_gluten_free: true, cost_tier: 2, ease_score: 0.75, is_one_pot: true,
  ingredients: [M("Chicken thighs", 400, "g"), V("Onion", 1), V("Garlic", 3, "clove"), P("Canned tomatoes", 1, "can"),
    P("Chipotle in adobo", 1, "tbsp"), P("Chicken stock", 5, "cup"), P("Corn tortillas", 4), V("Lime", 1), V("Avocado", 1)],
  instructions: ["Blend the tomatoes, onion, garlic and chipotle, then fry the purée until it deepens.",
    "Add the stock and the chicken and simmer 20 minutes; remove and shred the chicken.",
    "Return the chicken to the broth and season.",
    "Fry or bake thin tortilla strips until crisp.",
    "Ladle the soup and top with tortilla strips, avocado and lime."] });

add({ id: "huevos-rancheros", name: "Huevos Rancheros",
  description: "Fried eggs on tortillas with a warm ranchero tomato-chilli sauce and beans.",
  cuisine: "mexican", cook_time: 20, calories_per_serving: 380, primary_protein: "none",
  is_vegetarian: true, contains_dairy: false, is_dairy_free: true, is_gluten_free: true, cost_tier: 1, ease_score: 0.8,
  ingredients: [D("Eggs", 4), P("Corn tortillas", 4), P("Canned tomatoes", 1, "can"), V("Onion", 1),
    V("Garlic", 2, "clove"), V("Jalapeño", 1), P("Refried or black beans", 1, "can"), V("Cilantro", 0.25, "cup")],
  instructions: ["Make the sauce: fry onion, garlic and jalapeño, add tomatoes and simmer 10 minutes; season.",
    "Warm the beans.",
    "Lightly fry the tortillas and spread with beans.",
    "Fry the eggs to your liking.",
    "Sit an egg on each tortilla, spoon over the ranchero sauce and finish with cilantro."] });

add({ id: "pork-pozole-rojo", name: "Pozole Rojo (Pork & Hominy Stew)",
  description: "Mexican red chilli broth with pork and hominy, finished with crunchy toppings.",
  cuisine: "mexican", cook_time: 90, calories_per_serving: 440, primary_protein: "pork",
  is_dairy_free: true, is_gluten_free: true, cost_tier: 2, ease_score: 0.5, is_one_pot: true,
  ingredients: [M("Pork shoulder, cubed", 700, "g"), P("Hominy", 2, "can"), V("Onion", 1), V("Garlic", 5, "clove"),
    P("Dried guajillo chillies", 4), P("Cumin", 1, "tsp"), P("Oregano", 1, "tsp"), V("Cabbage", 0.25, ""), V("Radishes", 4)],
  instructions: ["Simmer the pork with onion and garlic in salted water for 1 hour until tender.",
    "Soak the chillies in hot water, then blend with some soaking liquid, cumin and oregano into a smooth sauce.",
    "Strain the sauce into the pot with the pork.",
    "Add the drained hominy and simmer 20 minutes.",
    "Serve topped with shredded cabbage, sliced radish and lime."] });

/* ========================= VEGETARIAN / MISC ========================= */
add({ id: "shakshuka-feta-greens", name: "Green Shakshuka with Feta",
  description: "Eggs poached in a garlicky pan of spinach, chard and herbs with feta.",
  cuisine: "middle-eastern", cook_time: 25, calories_per_serving: 320, primary_protein: "none",
  is_vegetarian: true, is_gluten_free: true, contains_dairy: true, cost_tier: 1, ease_score: 0.75, is_one_pot: true,
  ingredients: [V("Spinach", 200, "g"), V("Chard or kale", 200, "g"), V("Leek", 1), V("Garlic", 3, "clove"),
    D("Eggs", 4), D("Feta", 100, "g"), P("Cumin", 1, "tsp"), V("Cilantro", 0.5, "cup"), P("Olive oil", 2, "tbsp")],
  instructions: ["Soften the sliced leek and garlic in olive oil with the cumin.",
    "Add the greens in handfuls until wilted and add a splash of water.",
    "Season and make four wells.",
    "Crack in the eggs, crumble over the feta, cover and cook until the whites set.",
    "Scatter with cilantro and serve with bread."] });

add({ id: "halloumi-traybake", name: "Halloumi & Vegetable Traybake",
  description: "Roasted peppers, courgette and chickpeas with halloumi and za'atar.",
  cuisine: "mediterranean", cook_time: 35, calories_per_serving: 400, primary_protein: "none",
  is_vegetarian: true, is_gluten_free: true, contains_dairy: true, cost_tier: 2, ease_score: 0.85,
  ingredients: [D("Halloumi", 250, "g"), V("Bell peppers", 2), V("Courgette", 1), V("Red onion", 1),
    P("Chickpeas", 1, "can"), P("Za'atar", 1, "tbsp"), P("Olive oil", 3, "tbsp"), V("Lemon", 1), V("Cherry tomatoes", 1, "cup")],
  instructions: ["Chop the vegetables and toss with the chickpeas, olive oil and half the za'atar in a roasting tray.",
    "Roast at 200C for 20 minutes.",
    "Slice the halloumi and nestle it among the vegetables.",
    "Roast 12 minutes more until the halloumi is golden and the vegetables are soft.",
    "Squeeze over lemon and scatter the rest of the za'atar before serving."] });

add({ id: "stuffed-peppers-rice-feta", name: "Rice & Feta Stuffed Peppers",
  description: "Bell peppers baked with a herby tomato rice and feta filling.",
  cuisine: "mediterranean", cook_time: 50, calories_per_serving: 360, primary_protein: "none",
  is_vegetarian: true, is_gluten_free: true, contains_dairy: true, cost_tier: 1, ease_score: 0.7,
  ingredients: [V("Bell peppers", 4), P("Cooked rice", 2, "cup"), V("Tomatoes", 2), V("Onion", 1),
    D("Feta", 100, "g"), V("Parsley", 0.5, "cup"), V("Garlic", 2, "clove"), P("Dried oregano", 1, "tsp"), P("Olive oil", 2, "tbsp")],
  instructions: ["Halve and seed the peppers and sit them in a baking dish.",
    "Fry onion and garlic, add chopped tomato and oregano, then fold through the rice, parsley and crumbled feta.",
    "Pile the filling into the peppers.",
    "Drizzle with olive oil and add a splash of water to the dish.",
    "Cover with foil and bake at 190C for 30 minutes, then uncover for 10 to colour."] });

add({ id: "creamy-tomato-gnocchi", name: "Creamy Tomato Gnocchi",
  description: "Pan-crisped gnocchi in a quick creamy tomato and basil sauce.",
  cuisine: "italian", cook_time: 20, calories_per_serving: 440, primary_protein: "none",
  is_vegetarian: true, contains_dairy: true, cost_tier: 1, ease_score: 0.85, is_one_pot: true,
  ingredients: [P("Potato gnocchi", 500, "g"), P("Canned tomatoes", 1, "can"), V("Garlic", 2, "clove"),
    D("Cream", 0.5, "cup"), V("Basil", 0.5, "cup"), P("Olive oil", 2, "tbsp"), D("Parmesan", 0.5, "cup"), P("Chilli flakes", 0.5, "tsp")],
  instructions: ["Pan-fry the gnocchi in olive oil until golden; set aside.",
    "Soften the garlic and chilli, then add the tomatoes and simmer 8 minutes.",
    "Stir in the cream.",
    "Return the gnocchi and warm through in the sauce.",
    "Off the heat stir in basil and parmesan and serve."] });

add({ id: "chickpea-coconut-curry", name: "Chickpea & Coconut Curry",
  description: "Fast weeknight chickpea curry in spiced coconut tomato sauce.",
  cuisine: "indian", cook_time: 25, calories_per_serving: 380, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, is_dairy_free: true, is_gluten_free: true, cost_tier: 1, ease_score: 0.85, is_one_pot: true,
  ingredients: [P("Chickpeas", 2, "can"), D("Coconut milk", 1, "can"), V("Onion", 1), V("Garlic", 3, "clove"),
    V("Ginger", 1, "tbsp"), P("Canned tomatoes", 1, "can"), P("Curry powder", 2, "tbsp"), V("Spinach", 200, "g"), V("Lime", 1)],
  instructions: ["Soften onion, garlic and ginger, then toast the curry powder.",
    "Add the tomatoes and cook to a thick base.",
    "Add the chickpeas and coconut milk and simmer 12 minutes.",
    "Wilt in the spinach.",
    "Finish with lime juice and serve with rice."] });

add({ id: "lentil-shepherds-pie", name: "Lentil Shepherd's Pie",
  description: "Savoury lentil and vegetable base under a golden mashed potato crust.",
  cuisine: "american", cook_time: 55, calories_per_serving: 400, primary_protein: "none",
  is_vegetarian: true, contains_dairy: true, cost_tier: 1, ease_score: 0.6,
  ingredients: [P("Brown lentils", 1.5, "cup"), V("Potatoes", 800, "g"), V("Onion", 1), V("Carrots", 2),
    P("Frozen peas", 1, "cup"), P("Tomato paste", 2, "tbsp"), P("Vegetable stock", 2, "cup"), P("Butter", 3, "tbsp"), P("Thyme", 1, "tsp")],
  instructions: ["Boil the potatoes and mash with butter and salt.",
    "Soften onion and carrot, add tomato paste and thyme, then the lentils and stock.",
    "Simmer 25 minutes until the lentils are tender and saucy, stirring in the peas at the end.",
    "Spread the lentils in a dish and top with the mash, roughing up the surface.",
    "Bake at 200C for 20 minutes until the top is golden."] });

add({ id: "miso-glazed-aubergine", name: "Miso-Glazed Aubergine (Nasu Dengaku)",
  description: "Roasted aubergine halves lacquered with sweet-savoury miso glaze over rice.",
  cuisine: "asian", cook_time: 30, calories_per_serving: 300, primary_protein: "none",
  is_vegetarian: true, is_dairy_free: true, cost_tier: 1, ease_score: 0.8,
  ingredients: [V("Aubergines", 2), P("White miso", 3, "tbsp"), P("Mirin", 2, "tbsp"), P("Sugar", 1, "tbsp"),
    P("Sesame oil", 1, "tbsp"), V("Spring onions", 2), P("Sesame seeds", 1, "tbsp"), P("Cooked rice", 4, "cup")],
  instructions: ["Halve the aubergines and score the cut sides in a diamond pattern.",
    "Brush with sesame oil and roast cut-side up at 200C for 20 minutes until soft.",
    "Whisk the miso, mirin and sugar into a glaze.",
    "Spread the glaze over the aubergines and grill 4 minutes until bubbling and caramelised.",
    "Scatter with spring onion and sesame seeds and serve over rice."] });

add({ id: "white-bean-kale-soup", name: "White Bean, Kale & Garlic Soup",
  description: "Brothy garlic white bean soup with kale and a parmesan finish.",
  cuisine: "italian", cook_time: 30, calories_per_serving: 300, primary_protein: "none",
  is_vegetarian: true, contains_dairy: true, cost_tier: 1, ease_score: 0.85, is_one_pot: true,
  ingredients: [P("Cannellini beans", 2, "can"), V("Kale", 200, "g"), V("Onion", 1), V("Garlic", 5, "clove"),
    V("Carrot", 1), P("Vegetable stock", 5, "cup"), D("Parmesan rind", 1), P("Olive oil", 3, "tbsp"), P("Chilli flakes", 0.5, "tsp")],
  instructions: ["Soften the onion, carrot and garlic in olive oil with the chilli.",
    "Add the beans, stock and parmesan rind and simmer 15 minutes.",
    "Mash some of the beans against the pot to thicken the broth.",
    "Stir in the shredded kale and cook 5 minutes until tender.",
    "Remove the rind, season and serve with grated parmesan and olive oil."] });

add({ id: "egg-fried-rice-veg", name: "Vegetable Egg Fried Rice",
  description: "Fast wok fried rice with egg, peas, carrot and spring onion.",
  cuisine: "asian", cook_time: 12, calories_per_serving: 360, primary_protein: "none",
  is_vegetarian: true, is_dairy_free: true, cost_tier: 1, ease_score: 0.9, is_one_pot: true,
  ingredients: [P("Cooked cold rice", 4, "cup"), D("Eggs", 3), P("Frozen peas", 1, "cup"), V("Carrot", 1),
    V("Spring onions", 3), V("Garlic", 2, "clove"), P("Soy sauce", 3, "tbsp"), P("Sesame oil", 1, "tbsp"), P("Vegetable oil", 2, "tbsp")],
  instructions: ["Scramble the eggs in hot oil and set aside.",
    "Stir-fry the diced carrot and garlic for 2 minutes, then add the peas.",
    "Add the cold rice and toss over high heat to heat through and crisp slightly.",
    "Add the soy and sesame oil and the egg back in.",
    "Toss with sliced spring onions and serve."] });

add({ id: "caprese-orzo-skillet", name: "Caprese Orzo Skillet",
  description: "One-pan orzo cooked in tomato with mozzarella and basil stirred through.",
  cuisine: "italian", cook_time: 25, calories_per_serving: 420, primary_protein: "none",
  is_vegetarian: true, contains_dairy: true, cost_tier: 1, ease_score: 0.85, is_one_pot: true,
  ingredients: [P("Orzo", 1.5, "cup"), V("Cherry tomatoes", 2, "cup"), V("Garlic", 3, "clove"),
    P("Vegetable stock", 3, "cup"), D("Fresh mozzarella", 150, "g"), V("Basil", 0.5, "cup"), P("Olive oil", 2, "tbsp"), P("Tomato paste", 1, "tbsp")],
  instructions: ["Soften the garlic in olive oil, add the tomato paste and halved tomatoes and cook until they burst.",
    "Stir in the orzo, then add the stock.",
    "Simmer, stirring often, for about 12 minutes until the orzo is tender and creamy.",
    "Tear in the mozzarella and let it melt.",
    "Fold through basil and serve."] });

add({ id: "spiced-cauliflower-chickpea-bowl", name: "Roasted Cauliflower & Chickpea Bowl",
  description: "Spiced roasted cauliflower and chickpeas over grains with a lemon-tahini drizzle.",
  cuisine: "middle-eastern", cook_time: 35, calories_per_serving: 410, primary_protein: "none",
  is_vegetarian: true, is_pescatarian: true, is_dairy_free: true, cost_tier: 1, ease_score: 0.8,
  ingredients: [V("Cauliflower", 1), P("Chickpeas", 1, "can"), P("Cumin", 1, "tsp"), P("Smoked paprika", 1, "tsp"),
    P("Tahini", 3, "tbsp"), V("Lemon", 1), V("Garlic", 1, "clove"), P("Cooked grains or rice", 3, "cup"), V("Parsley", 0.5, "cup")],
  instructions: ["Toss cauliflower florets and the drained chickpeas with oil, cumin and paprika.",
    "Roast at 220C for 25 minutes until charred and crisp.",
    "Whisk the tahini with lemon, grated garlic and water into a pourable sauce.",
    "Pile the grains, cauliflower and chickpeas into bowls.",
    "Drizzle with tahini sauce and scatter parsley."] });

/* ========================= EXTRA FISH ========================= */
add({ id: "miso-salmon-traybake", name: "Miso Salmon Traybake",
  description: "Salmon fillets glazed with miso and honey, roasted with broccoli.",
  cuisine: "asian", cook_time: 20, calories_per_serving: 420, primary_protein: "fish",
  is_pescatarian: true, is_dairy_free: true, cost_tier: 3, ease_score: 0.85,
  ingredients: [F("Salmon fillets", 4), P("White miso", 2, "tbsp"), P("Honey", 1, "tbsp"), P("Soy sauce", 1, "tbsp"),
    V("Broccoli", 1), P("Sesame oil", 1, "tbsp"), V("Spring onions", 2), P("Sesame seeds", 1, "tbsp")],
  instructions: ["Whisk the miso, honey and soy into a glaze.",
    "Toss the broccoli florets with sesame oil on a tray and roast at 200C for 8 minutes.",
    "Add the salmon, brush with the glaze, and roast 10 minutes more.",
    "Spoon any tray juices over the fish.",
    "Top with spring onions and sesame seeds and serve with rice."] });

add({ id: "cod-chorizo-chickpeas", name: "Cod with Chorizo & Chickpeas",
  description: "Roasted cod over smoky chorizo, chickpeas and peppers.",
  cuisine: "mediterranean", cook_time: 30, calories_per_serving: 440, primary_protein: "fish",
  is_dairy_free: true, is_gluten_free: true, cost_tier: 3, ease_score: 0.8, is_one_pot: true,
  ingredients: [F("Cod fillets", 4), M("Chorizo", 150, "g"), P("Chickpeas", 1, "can"), V("Bell pepper", 1),
    V("Onion", 1), V("Garlic", 3, "clove"), P("Smoked paprika", 1, "tsp"), V("Parsley", 0.5, "cup"), P("Olive oil", 2, "tbsp")],
  instructions: ["Render sliced chorizo in an ovenproof pan until the oil turns red.",
    "Add the onion, pepper and garlic and soften.",
    "Stir in the chickpeas and smoked paprika and warm through.",
    "Nestle the cod on top, drizzle with oil, and roast at 200C for 12 minutes.",
    "Scatter with parsley and serve."] });

add({ id: "fish-tacos-slaw", name: "Crispy Fish Tacos with Lime Slaw",
  description: "Pan-fried white fish in warm tortillas with a crunchy lime cabbage slaw.",
  cuisine: "mexican", cook_time: 20, calories_per_serving: 400, primary_protein: "fish",
  is_pescatarian: true, cost_tier: 2, ease_score: 0.75,
  ingredients: [F("White fish fillets", 600, "g"), P("Corn tortillas", 8), V("Cabbage", 0.25, ""),
    V("Lime", 2), D("Yogurt or sour cream", 0.5, "cup"), P("Cumin", 1, "tsp"), P("Smoked paprika", 1, "tsp"),
    V("Cilantro", 0.5, "cup"), P("Flour", 0.5, "cup")],
  instructions: ["Toss shredded cabbage with lime juice, a little yogurt, salt and cilantro for the slaw.",
    "Dust the fish with flour, cumin and paprika.",
    "Pan-fry in oil until golden and just cooked, about 3 minutes per side; break into chunks.",
    "Warm the tortillas.",
    "Fill with fish and slaw, add a dollop of yogurt and a squeeze of lime."] });

add({ id: "sardine-spaghetti", name: "Sicilian Sardine Spaghetti",
  description: "Spaghetti with sardines, fennel, raisins, pine nuts and toasted crumbs.",
  cuisine: "italian", cook_time: 25, calories_per_serving: 470, primary_protein: "fish",
  is_pescatarian: true, is_dairy_free: true, cost_tier: 2, ease_score: 0.65,
  ingredients: [P("Spaghetti", 400, "g"), F("Canned sardines", 2, "can"), V("Fennel bulb", 1), V("Onion", 1),
    P("Raisins", 0.25, "cup"), P("Pine nuts", 0.25, "cup"), P("Breadcrumbs", 0.5, "cup"), V("Garlic", 2, "clove"), P("Olive oil", 4, "tbsp")],
  instructions: ["Toast the breadcrumbs in a little oil until golden; set aside.",
    "Soften the sliced fennel and onion with the garlic.",
    "Add the raisins, pine nuts and flaked sardines and warm through.",
    "Toss the cooked spaghetti through with a splash of pasta water.",
    "Top each plate with the toasted crumbs."] });

add({ id: "thai-fish-cakes", name: "Thai Fish Cakes with Cucumber Relish",
  description: "Bouncy red-curry fish cakes with a sweet-sour cucumber relish.",
  cuisine: "asian", cook_time: 25, calories_per_serving: 350, primary_protein: "fish",
  is_pescatarian: true, is_dairy_free: true, cost_tier: 2, ease_score: 0.6,
  ingredients: [F("White fish fillets", 500, "g"), P("Red curry paste", 2, "tbsp"), P("Fish sauce", 1, "tbsp"),
    V("Green beans", 100, "g"), D("Egg", 1), V("Cucumber", 1), P("Sugar", 2, "tbsp"), P("Rice vinegar", 3, "tbsp"), V("Cilantro", 0.25, "cup")],
  instructions: ["Blend the fish with the curry paste, fish sauce and egg into a sticky paste.",
    "Fold in finely sliced green beans.",
    "Shape into small patties.",
    "Fry in oil until golden and cooked through, about 3 minutes per side.",
    "Make the relish by dissolving the sugar in the vinegar and adding diced cucumber and cilantro; serve alongside."] });

add({ id: "prawn-coconut-curry-goan", name: "Goan Prawn Coconut Curry",
  description: "Tangy Goan prawn curry in a coconut, tomato and tamarind sauce.",
  cuisine: "indian", cook_time: 25, calories_per_serving: 380, primary_protein: "fish",
  is_pescatarian: true, is_dairy_free: true, is_gluten_free: true, cost_tier: 3, ease_score: 0.7, is_one_pot: true,
  ingredients: [F("Prawns, peeled", 500, "g"), D("Coconut milk", 1, "can"), V("Onion", 1), V("Garlic", 3, "clove"),
    V("Ginger", 1, "tbsp"), P("Tomato passata", 1, "cup"), P("Tamarind paste", 1, "tbsp"), P("Turmeric", 1, "tsp"), P("Chilli powder", 1, "tsp")],
  instructions: ["Fry onion, garlic and ginger until soft.",
    "Add the turmeric and chilli, then the passata, and cook to a thick base.",
    "Stir in the coconut milk and tamarind and simmer 8 minutes.",
    "Add the prawns and cook 4 minutes until pink.",
    "Adjust the salt and tang and serve with rice."] });

/* ===== write out ===== */
const PATH = "./seed/recipes.seed.json";
const existing = JSON.parse(readFileSync(PATH, "utf8"));
const haveIds = new Set(existing.map((x) => x.id));
const haveNames = new Set(existing.map((x) => x.name.toLowerCase()));
const fresh = R.filter((x) => !haveIds.has(x.id) && !haveNames.has(x.name.toLowerCase()));
const dupes = R.length - fresh.length;
const merged = existing.concat(fresh);
writeFileSync(PATH, JSON.stringify(merged, null, 2));
console.log(`authored ${R.length}, skipped ${dupes} dupes, added ${fresh.length}. Total now ${merged.length}.`);
