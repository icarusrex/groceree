// Appends the curated budget GF/DF recipe collection to seed/recipes.seed.json.
// Idempotent: dedupes by id. Run: node scripts/add_curated_recipes.mjs
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "curated-budget-gfdf";
const NORM = {
  cups: "cup", cup: "cup", tablespoons: "tbsp", tablespoon: "tbsp", tbsp: "tbsp",
  teaspoons: "tsp", teaspoon: "tsp", tsp: "tsp", cloves: "clove", clove: "clove",
  pounds: "lb", pound: "lb", lbs: "lb", lb: "lb", ounces: "oz", ounce: "oz", oz: "oz",
  can: "can", cans: "can", "": "", g: "g", ml: "ml", bunch: "bunch", inch: "inch",
};
const ing = (name, quantity, unit, category) => ({
  name, quantity, unit, unit_norm: NORM[unit] ?? unit, category,
});
// shorthands by aisle
const P = (n, q, u) => ing(n, q, u, "pantry");      // pantry / canned / dry / oils / spices / sauces
const V = (n, q, u) => ing(n, q, u, "produce");     // fresh produce & herbs
const M = (n, q, u) => ing(n, q, u, "meat");        // poultry / sausage
const D = (n, q, u) => ing(n, q, u, "dairy");       // eggs, coconut milk, nut butters (aisle convention)

const R = [];
const add = (r) => R.push({
  meal_type: "dinner",
  is_gluten_free: true, is_dairy_free: true, contains_dairy: false,
  source: SOURCE,
  ...r,
  ingredient_count: r.ingredients.length,
});

// ---------- CATEGORY 1: Bean, Legume & Grain ----------
add({ id: "creamy-coconut-curry-lentils-spinach", name: "Creamy Coconut Curry Lentils with Spinach",
  description: "Brown lentils simmered in curried coconut milk with wilted spinach, served over rice.",
  cuisine: "indian", difficulty: "easy", prep_time: 5, cook_time: 40, total_time: 45, servings: 4,
  calories_per_serving: 430, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.8, is_one_pot: true,
  ingredients: [ P("Olive oil", 2, "tbsp"), V("Garlic", 2, "clove"), V("Fresh ginger", 1, "tsp"),
    V("Yellow onion", 1, ""), P("Curry powder", 1, "tbsp"), P("Dry brown lentils", 1, "cup"),
    P("Vegetable broth", 2, "cup"), D("Coconut milk", 1, "can"), V("Baby spinach", 3, "cup"),
    P("Cooked rice", 4, "cup"), V("Cilantro", 0.25, "cup") ],
  instructions: ["Saute garlic and ginger in the oil in a deep skillet for 1 minute.",
    "Add diced onion and cook until soft, then add curry powder and toast 1 minute.",
    "Add lentils and broth, bring to a boil, cover and simmer 20 minutes.",
    "Stir in coconut milk and simmer uncovered 10 minutes to thicken.",
    "Off heat, stir in spinach to wilt and adjust salt and curry.",
    "Serve over rice with chopped cilantro."] });

add({ id: "mujaddara-rice-lentil-pilaf", name: "Mujaddara (Rice and Lentil Pilaf with Caramelized Onions)",
  description: "Cheap, deeply savoury pilaf of rice and lentils crowned with slow caramelized onions.",
  cuisine: "middle-eastern", difficulty: "medium", prep_time: 10, cook_time: 100, total_time: 110, servings: 6,
  calories_per_serving: 350, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.6, is_one_pot: true,
  ingredients: [ P("Olive oil", 2, "tbsp"), V("Yellow onions", 4, ""), P("Cumin", 1, "tsp"),
    P("Allspice", 1, "tsp"), P("Ground cloves", 0.25, "tsp"), P("Vegetable broth", 2.5, "cup"),
    P("Long grain white rice", 1, "cup"), P("Brown lentils", 1, "cup") ],
  instructions: ["Thinly slice the onions and cook in oil over low heat about 1 hour until deeply caramelized; remove half to top later.",
    "Add cumin, allspice and cloves to the remaining onions and toast 1 minute.",
    "Add the broth and scrape the pot.",
    "Add lentils and simmer until partly tender, then add the rice.",
    "Cover and cook until rice and lentils are tender and the liquid is absorbed.",
    "Top with the reserved caramelized onions."] });

add({ id: "quick-chana-masala", name: "Quick Chana Masala",
  description: "Fast chickpea curry in a spiced fire-roasted tomato sauce.",
  cuisine: "indian", difficulty: "easy", prep_time: 15, cook_time: 20, total_time: 35, servings: 4,
  calories_per_serving: 400, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.82, is_one_pot: true,
  ingredients: [ P("Brown basmati rice", 1, "cup"), P("Coconut oil", 2, "tbsp"), V("Yellow onion", 1, ""),
    V("Serrano or jalapeno", 1, ""), V("Garlic", 5, "clove"), V("Fresh ginger", 1, "tbsp"),
    P("Garam masala", 1.5, "tsp"), P("Ground coriander", 1.5, "tsp"), P("Ground cumin", 0.75, "tsp"),
    P("Ground turmeric", 0.5, "tsp"), P("Fire-roasted crushed tomatoes", 1, "can"),
    P("Chickpeas", 2, "can"), V("Lemon", 1, ""), V("Cilantro", 0.25, "cup") ],
  instructions: ["Cook the rice if serving.",
    "Warm oil over medium-low and cook onion, minced serrano and salt about 5 minutes.",
    "Add garlic and ginger 30 to 60 seconds, then add the spices and cook 1 minute.",
    "Add the tomatoes with juices, breaking up any whole pieces.",
    "Add the drained chickpeas and simmer 10 minutes or more, then season.",
    "Serve over rice with lemon and cilantro."] });

add({ id: "quick-curried-chickpeas-spinach", name: "Quick Curried Chickpeas with Spinach",
  description: "Twenty-minute pantry curry of chickpeas and spinach in tomato sauce.",
  cuisine: "indian", difficulty: "easy", prep_time: 5, cook_time: 20, total_time: 25, servings: 4,
  calories_per_serving: 380, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.85, is_one_pot: true,
  ingredients: [ P("Olive oil", 2, "tbsp"), V("Yellow onion", 1, ""), V("Garlic", 2, "clove"),
    V("Fresh ginger", 1, "inch"), P("Curry powder", 1.5, "tbsp"), V("Spinach", 8, "oz"),
    P("Tomato sauce", 15, "oz"), P("Chickpeas", 2, "can") ],
  instructions: ["Saute onion, garlic and ginger in the oil 3 to 5 minutes.",
    "Add curry powder for 1 minute, then add a splash of water and the spinach to wilt.",
    "Add the drained chickpeas and tomato sauce, stir and heat through 5 minutes.",
    "Serve over rice or with bread."] });

add({ id: "chana-saag-chickpeas-spinach", name: "Chana Saag (Creamy Chickpeas and Spinach)",
  description: "Chickpeas and spinach simmered creamy with coconut milk over rice.",
  cuisine: "indian", difficulty: "easy", prep_time: 10, cook_time: 25, total_time: 35, servings: 4,
  calories_per_serving: 420, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.8, is_one_pot: true,
  ingredients: [ P("White rice", 1.5, "cup"), P("Olive oil", 2, "tbsp"), V("Onion", 1, ""),
    V("Garlic", 3, "clove"), V("Fresh ginger", 1, "tbsp"), P("Curry powder", 1.5, "tbsp"),
    V("Spinach", 8, "oz"), P("Chickpeas", 1, "can"), D("Coconut milk", 1, "can") ],
  instructions: ["Cook the rice.",
    "Saute the aromatics and add curry powder.",
    "Add spinach to wilt, then the chickpeas and coconut milk.",
    "Simmer until creamy and serve over rice."] });

add({ id: "sri-lankan-coconut-lentils", name: "Coconut Lentils (Sri Lankan Parippu)",
  description: "Ultra-cheap red lentils cooked soft in turmeric coconut milk.",
  cuisine: "indian", difficulty: "easy", prep_time: 5, cook_time: 25, total_time: 30, servings: 4,
  calories_per_serving: 316, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.85, is_one_pot: true,
  ingredients: [ P("Red lentils", 1, "cup"), V("Garlic", 3, "clove"), P("Turmeric", 0.5, "tsp"),
    D("Coconut milk", 1, "can"), P("Water", 1.5, "cup") ],
  instructions: ["Rinse the lentils 2 to 3 times.",
    "Add garlic, salt, turmeric, coconut milk and the water, then stir.",
    "Bring to a boil then simmer about 20 minutes until the liquid is absorbed.",
    "Rest 5 minutes and season."] });

add({ id: "cuban-black-beans-and-rice", name: "Cuban Black Beans and Rice",
  description: "Dried black beans simmered with sofrito, vinegar and a touch of sugar, over rice.",
  cuisine: "latin", difficulty: "medium", prep_time: 15, cook_time: 75, total_time: 90, servings: 4,
  calories_per_serving: 410, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.62, is_one_pot: false,
  ingredients: [ P("Dried black beans", 0.5, "lb"), V("Green pepper", 1, ""), V("Onion", 1, ""),
    V("Garlic", 4, "clove"), P("Bay leaf", 1, ""), P("Olive oil", 2, "tbsp"), P("Cumin", 1, "tsp"),
    P("Oregano", 1, "tsp"), P("Paprika", 1, "tsp"), P("Vinegar", 1, "tbsp"), P("Sugar", 1, "tsp"),
    P("Rice", 1.5, "cup") ],
  instructions: ["Simmer the soaked beans with half the pepper, a quarter of the onion, 2 cloves garlic and the bay leaf about 45 minutes.",
    "Make a sofrito: saute the remaining onion, pepper and garlic, then add cumin, oregano and paprika 30 seconds.",
    "Combine the sofrito with the beans and add vinegar and sugar; simmer to thicken.",
    "Serve over rice."] });

// ---------- CATEGORY 2: Dahl & Indian-Inspired ----------
add({ id: "one-pot-green-curry-lentil-dal", name: "1-Pot Lentil Green Curry Dal",
  description: "One-pot lentil dal built on green curry paste and coconut milk.",
  cuisine: "indian", difficulty: "easy", prep_time: 10, cook_time: 30, total_time: 40, servings: 4,
  calories_per_serving: 400, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.82, is_one_pot: true,
  ingredients: [ P("Coconut oil", 1, "tbsp"), V("Green chili", 1, ""), V("Fresh ginger", 1, "tbsp"),
    V("Shallot", 1, ""), V("Garlic", 3, "clove"), P("Lentils", 1, "cup"),
    P("Green curry paste", 3, "tbsp"), D("Coconut milk", 1, "can"), P("Rice", 1.5, "cup") ],
  instructions: ["Heat the pot and add coconut oil, chili, ginger, shallot and garlic.",
    "Add the curry paste and stir.",
    "Add lentils and coconut milk and simmer until tender (use canned lentils and warm 10 minutes to shorten).",
    "Serve over rice."] });

add({ id: "best-red-lentil-dahl", name: "Red Lentil Dahl",
  description: "Vegetable-loaded split red lentil dahl finished with coconut milk and citrus.",
  cuisine: "indian", difficulty: "easy", prep_time: 10, cook_time: 25, total_time: 35, servings: 6,
  calories_per_serving: 360, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.8, is_one_pot: true,
  ingredients: [ P("Olive oil", 2, "tbsp"), V("Onion", 1, ""), V("Fresh ginger", 1, "tbsp"),
    V("Garlic", 3, "clove"), V("Carrot", 1, ""), V("Bell pepper", 1, ""), P("Curry powder", 1, "tbsp"),
    P("Garam masala", 1, "tsp"), P("Turmeric", 0.5, "tsp"), P("Cumin", 1, "tsp"),
    P("Split red lentils", 1.5, "cup"), P("Vegetable broth", 3, "cup"), P("Canned tomatoes", 1, "can"),
    D("Coconut milk", 1, "can"), V("Lime", 1, "") ],
  instructions: ["Saute the onion 3 to 4 minutes, then add ginger, garlic, carrot and bell pepper.",
    "Add the spices, lentils and broth, bring to a boil and simmer about 10 minutes.",
    "Add coconut milk and cook 5 minutes more to your desired thickness.",
    "Season and serve with rice or potatoes."] });

// ---------- CATEGORY 3: Pasta-style / Lentil Bolognese ----------
add({ id: "lentil-bolognese-vegan-gf", name: "Lentil Bolognese (Vegan, Gluten-Free)",
  description: "Quick weeknight lentil and mushroom bolognese over gluten-free pasta.",
  cuisine: "italian", difficulty: "easy", prep_time: 10, cook_time: 25, total_time: 35, servings: 4,
  calories_per_serving: 450, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.78, is_one_pot: false,
  ingredients: [ P("Gluten-free pasta", 12, "oz"), V("Onion", 1, ""), V("Garlic", 3, "clove"),
    V("Mushrooms", 8, "oz"), P("Oregano", 1, "tsp"), P("Red pepper flakes", 0.25, "tsp"),
    P("Olive oil", 1, "tbsp"), P("Canned diced tomatoes", 1, "can"), P("Tomato sauce", 15, "oz"),
    P("Green or brown lentils", 1, "cup") ],
  instructions: ["Cook the gluten-free pasta.",
    "Saute onion, garlic, mushrooms and spices 3 to 5 minutes.",
    "Add diced tomatoes with liquid, tomato sauce, lentils and water; cover, boil then simmer 18 to 25 minutes.",
    "Serve over the pasta."] });

add({ id: "red-lentil-walnut-bolognese", name: "Red Lentil and Walnut Bolognese",
  description: "Ten-ingredient red lentil bolognese with walnuts for a meaty base.",
  cuisine: "italian", difficulty: "easy", prep_time: 10, cook_time: 45, total_time: 55, servings: 5,
  calories_per_serving: 470, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.72, is_one_pot: false,
  ingredients: [ P("Olive oil", 2, "tbsp"), V("Onion", 1, ""), V("Carrot", 2, ""), V("Celery", 2, ""),
    V("Garlic", 4, "clove"), V("Mushrooms", 8, "oz"), P("Red lentils", 1, "cup"), D("Walnuts", 0.5, "cup"),
    P("Tomato paste", 1, "can"), P("Canned tomatoes", 1, "can"), P("Vegetable broth", 2, "cup"),
    V("Fresh basil", 0.25, "cup"), P("Gluten-free pasta", 12, "oz") ],
  instructions: ["Saute the onion, carrot, celery, garlic and mushrooms into a soffritto.",
    "Add lentils, chopped walnuts, tomato paste, tomatoes and broth.",
    "Simmer until thick and the lentils are tender.",
    "Serve over gluten-free pasta with basil."] });

add({ id: "lentil-bolognese-pappardelle", name: "Vegetarian Lentil Bolognese with Pappardelle",
  description: "Creamy red lentil bolognese brightened with balsamic, over GF pappardelle.",
  cuisine: "italian", difficulty: "medium", prep_time: 10, cook_time: 50, total_time: 60, servings: 5,
  calories_per_serving: 460, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.68, is_one_pot: false,
  ingredients: [ P("Olive oil", 2, "tbsp"), V("Onion", 1, ""), V("Carrot", 2, ""), V("Celery", 2, ""),
    V("Garlic", 4, "clove"), V("Mushrooms", 8, "oz"), P("Red lentils", 1, "cup"),
    P("Vegetable broth", 4, "cup"), P("Balsamic vinegar", 1, "tbsp"), P("Gluten-free pappardelle", 12, "oz"),
    P("Bay leaf", 1, ""), V("Fresh parsley", 0.25, "cup") ],
  instructions: ["Saute the aromatics.",
    "Add lentils and broth and simmer until creamy.",
    "Remove the bay leaf and stir in the balsamic.",
    "Cook the gluten-free pasta separately, then combine and garnish."] });

// ---------- CATEGORY 4: One-pan / Sheet-pan / Skillet ----------
add({ id: "sheet-pan-greek-chicken-vegetables", name: "Sheet Pan Greek Chicken and Vegetables",
  description: "Lemon-oregano chicken roasted with peppers, tomatoes and onion on one tray.",
  cuisine: "mediterranean", difficulty: "easy", prep_time: 10, cook_time: 40, total_time: 50, servings: 4,
  calories_per_serving: 480, is_vegetarian: false, is_pescatarian: false, primary_protein: "chicken",
  ease_score: 0.8, is_one_pot: true,
  ingredients: [ P("Olive oil", 0.25, "cup"), V("Lemon", 1, ""), V("Garlic", 4, "clove"),
    P("Dried oregano", 0.5, "tbsp"), V("Grape tomatoes", 1, "pint"), V("Bell peppers", 2, ""),
    V("Red onion", 1, ""), M("Boneless skinless chicken breast", 1.5, "lb"), P("Kalamata olives", 15, ""),
    V("Parsley", 0.25, "cup"), P("Cooked rice", 4, "cup") ],
  instructions: ["Heat the oven to 400F and make the lemon, garlic, oregano and oil marinade.",
    "Chop the vegetables into 1 to 1.5 inch pieces, toss with half the marinade and roast 10 minutes.",
    "Pound the chicken even, cut each breast in two and coat with the remaining marinade.",
    "Add the chicken to the sheet and roast 20 to 25 minutes to 165F.",
    "Top with olives, lemon zest and parsley and serve over rice."] });

add({ id: "sheet-pan-honey-mustard-chicken", name: "Sheet Pan Honey Mustard Chicken and Veggies",
  description: "Chicken thighs and baby potatoes roasted in a tangy honey mustard glaze.",
  cuisine: "american", difficulty: "easy", prep_time: 10, cook_time: 40, total_time: 50, servings: 4,
  calories_per_serving: 592, is_vegetarian: false, is_pescatarian: false, primary_protein: "chicken",
  ease_score: 0.82, is_one_pot: true,
  ingredients: [ M("Chicken thighs", 2, "lb"), V("Baby potatoes", 1.5, "lb"), V("Mixed vegetables", 3, "cup"),
    P("Mayonnaise", 0.25, "cup"), P("Dijon mustard", 2, "tbsp"), P("Yellow mustard", 1, "tbsp"),
    P("Honey", 3, "tbsp"), P("Apple cider vinegar", 1, "tbsp"), P("Garlic powder", 0.5, "tsp"),
    P("Paprika", 0.5, "tsp") ],
  instructions: ["Heat the oven to 400F.",
    "Whisk the honey mustard sauce.",
    "Toss the chicken and vegetables with the sauce on a sheet pan.",
    "Roast 30 to 40 minutes until the chicken reaches 165F and the potatoes are tender."] });

add({ id: "roasted-chicken-and-vegetables", name: "Roasted Chicken and Vegetables",
  description: "Bone-in thighs roasted over herbed potatoes, carrots and onion.",
  cuisine: "american", difficulty: "easy", prep_time: 10, cook_time: 45, total_time: 55, servings: 4,
  calories_per_serving: 781, is_vegetarian: false, is_pescatarian: false, primary_protein: "chicken",
  ease_score: 0.8, is_one_pot: true,
  ingredients: [ M("Bone-in chicken thighs", 2, "lb"), V("Baby potatoes", 1.5, "lb"), V("Carrots", 4, ""),
    V("Red onion", 1, ""), V("Garlic", 6, "clove"), P("Olive oil", 3, "tbsp"), P("Dried basil", 1, "tsp"),
    P("Dried rosemary", 1, "tsp"), P("Dried thyme", 1, "tsp"), P("Paprika", 1, "tsp") ],
  instructions: ["Heat the oven to 425F.",
    "Mix the oil with the herbs and spices.",
    "Toss the vegetables with half and spread in a 9x13 dish.",
    "Coat the chicken with the rest, place on top and roast until the chicken is 165F and the vegetables are tender."] });

add({ id: "italian-sausage-white-bean-skillet", name: "Italian Sausage and White Bean Skillet",
  description: "Crispy Italian sausage with cannellini beans and wilted spinach in one pan.",
  cuisine: "italian", difficulty: "easy", prep_time: 5, cook_time: 20, total_time: 25, servings: 4,
  calories_per_serving: 520, is_vegetarian: false, is_pescatarian: false, primary_protein: "pork",
  ease_score: 0.85, is_one_pot: true,
  ingredients: [ M("Italian sausage", 1, "lb"), P("Olive oil", 1, "tbsp"), P("Cannellini beans", 2, "can"),
    V("Spinach", 8, "oz") ],
  instructions: ["Brown the sausage in the oil until crispy-edged, about 10 minutes.",
    "Add the drained beans and pepper and coat in the fat to heat through.",
    "Stir in the spinach in batches until wilted."] });

add({ id: "chicken-sausage-white-bean-skillet", name: "Chicken Sausage White Bean Skillet",
  description: "Fully-cooked chicken sausage with white beans in a light pan sauce and greens.",
  cuisine: "american", difficulty: "easy", prep_time: 10, cook_time: 20, total_time: 30, servings: 4,
  calories_per_serving: 470, is_vegetarian: false, is_pescatarian: false, primary_protein: "chicken",
  ease_score: 0.85, is_one_pot: true,
  ingredients: [ M("Chicken sausage links", 5, ""), P("Olive oil", 1, "tbsp"), V("Onion", 1, ""),
    V("Garlic", 3, "clove"), P("White beans", 2, "can"), P("Dried oregano", 1, "tsp"),
    P("Smoked paprika", 1, "tsp"), V("Spinach", 8, "oz") ],
  instructions: ["Slice and brown the sausage, then set aside.",
    "Saute onion and garlic in the remaining oil about 3 minutes.",
    "Add the beans (do not rinse, the starchy liquid makes a light sauce) and seasonings.",
    "Add spinach to wilt and return the sausage."] });

add({ id: "sun-dried-tomato-kale-white-bean-skillet", name: "Sun-Dried Tomato, Kale and White Bean Skillet",
  description: "Garlicky kale and white beans dressed with sun-dried tomatoes.",
  cuisine: "mediterranean", difficulty: "easy", prep_time: 10, cook_time: 15, total_time: 25, servings: 4,
  calories_per_serving: 340, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.82, is_one_pot: true,
  ingredients: [ P("White beans", 2, "can"), P("Sun-dried tomatoes", 0.5, "cup"),
    P("Apple cider vinegar", 1, "tbsp"), P("Dried basil", 1, "tsp"), P("Red pepper flakes", 0.25, "tsp"),
    P("Olive oil", 2, "tbsp"), V("Garlic", 3, "clove"), V("Kale", 1, "bunch") ],
  instructions: ["Make a dressing from the jar oil, vinegar, basil and seasonings.",
    "Saute garlic in olive oil 1 minute, then add the kale with 2 tablespoons water to wilt.",
    "Add the beans and sun-dried tomatoes to heat through.",
    "Drizzle the dressing and season."] });

// ---------- CATEGORY 5: Stir-fries & rice bowls (tamari) ----------
add({ id: "easy-chicken-stir-fry", name: "Easy Chicken Stir Fry",
  description: "Chicken and crisp vegetables in a glossy tamari-ginger sauce over rice.",
  cuisine: "asian", difficulty: "easy", prep_time: 15, cook_time: 15, total_time: 30, servings: 4,
  calories_per_serving: 450, is_vegetarian: false, is_pescatarian: false, primary_protein: "chicken",
  ease_score: 0.8, is_one_pot: true,
  ingredients: [ M("Chicken breast", 1, "lb"), P("Cooking oil", 2, "tbsp"), P("Tamari", 0.25, "cup"),
    P("Brown sugar", 2, "tbsp"), P("Toasted sesame oil", 1, "tbsp"), V("Garlic", 3, "clove"),
    V("Fresh ginger", 1, "tbsp"), P("Cornstarch", 1, "tbsp"), V("Broccoli", 3, "cup"),
    V("Red bell pepper", 1, ""), V("Carrots", 2, ""), V("Green onions", 3, ""), P("Rice", 1.5, "cup") ],
  instructions: ["Mix the tamari sauce ingredients.",
    "Chop the vegetables and chicken.",
    "Brown the chicken in hot oil, then remove.",
    "Stir-fry the vegetables tender-crisp.",
    "Return the chicken, add the sauce and toss until glossy; serve over rice."] });

add({ id: "one-pot-teriyaki-chicken-rice", name: "One Pot Teriyaki Chicken and Rice",
  description: "Chicken, jasmine rice and vegetables cooked together with GF teriyaki.",
  cuisine: "asian", difficulty: "easy", prep_time: 10, cook_time: 25, total_time: 35, servings: 4,
  calories_per_serving: 499, is_vegetarian: false, is_pescatarian: false, primary_protein: "chicken",
  ease_score: 0.82, is_one_pot: true,
  ingredients: [ M("Chicken breast", 0.66, "lb"), P("Cooking oil", 1, "tbsp"), V("Garlic", 2, "clove"),
    V("Fresh ginger", 1, "tsp"), P("Jasmine rice", 1.5, "cup"), P("Water", 2.5, "cup"),
    P("Gluten-free teriyaki sauce", 0.33, "cup"), V("Mixed vegetables", 2, "cup"), V("Green onions", 2, "") ],
  instructions: ["Saute garlic, ginger and chicken in the oil.",
    "Add the rice and toast 1 minute, then add water, boil and simmer covered about 15 minutes.",
    "Add the vegetables, drizzle the teriyaki and fold gently.",
    "Rest 5 minutes and top with green onion."] });

add({ id: "chicken-fried-rice", name: "Chicken Fried Rice",
  description: "Day-old rice stir-fried with chicken, egg and vegetables in tamari.",
  cuisine: "asian", difficulty: "easy", prep_time: 15, cook_time: 15, total_time: 30, servings: 4,
  calories_per_serving: 500, is_vegetarian: false, is_pescatarian: false, primary_protein: "chicken",
  ease_score: 0.8, is_one_pot: true,
  ingredients: [ M("Chicken breast", 0.66, "lb"), P("Toasted sesame oil", 1, "tbsp"), P("Cooking oil", 1, "tbsp"),
    P("Tamari", 3, "tbsp"), V("Garlic", 2, "clove"), V("Fresh ginger", 1, "tsp"), V("Green onions", 3, ""),
    V("Carrot", 1, ""), V("Red bell pepper", 1, ""), P("Frozen peas", 0.5, "cup"), D("Eggs", 2, ""),
    P("Cooked and cooled rice", 4, "cup") ],
  instructions: ["Scramble the eggs and set aside.",
    "Stir-fry the carrots, then the bell pepper and white green-onion ends, and add the chicken.",
    "Add the cold rice and return the eggs.",
    "Season with tamari and sesame oil and top with green onion."] });

// ---------- CATEGORY 6: Soups & Stews ----------
add({ id: "best-lentil-soup", name: "Best Lentil Soup",
  description: "Hearty curried lentil soup with greens, part-blended for body.",
  cuisine: "mediterranean", difficulty: "easy", prep_time: 10, cook_time: 45, total_time: 55, servings: 4,
  calories_per_serving: 380, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.78, is_one_pot: true,
  ingredients: [ P("Olive oil", 0.25, "cup"), V("Onion", 1, ""), V("Carrots", 2, ""), V("Garlic", 4, "clove"),
    P("Ground cumin", 2, "tsp"), P("Curry powder", 1, "tsp"), P("Dried thyme", 0.5, "tsp"),
    P("Canned diced tomatoes", 1, "can"), P("Brown or green lentils", 1, "cup"), P("Vegetable broth", 4, "cup"),
    P("Water", 2, "cup"), V("Kale or collard greens", 1, "cup"), V("Lemon", 1, "") ],
  instructions: ["Saute the onion and carrot 5 minutes.",
    "Add garlic, cumin, curry and thyme 30 seconds, then the tomatoes and cook a few minutes.",
    "Add lentils, broth, water, salt and pepper, boil then simmer partially covered 25 to 30 minutes.",
    "Blend 2 cups and return to the pot.",
    "Add the greens 5 minutes, stir in lemon juice and season."] });

add({ id: "smoky-black-bean-soup", name: "Smoky Black Bean Soup",
  description: "Smoky paprika black bean soup, partly pureed and finished with lime.",
  cuisine: "mexican", difficulty: "easy", prep_time: 10, cook_time: 25, total_time: 35, servings: 4,
  calories_per_serving: 351, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.82, is_one_pot: true,
  ingredients: [ P("Black beans", 2, "can"), V("Onion", 1, ""), V("Garlic", 3, "clove"), P("Cumin", 1, "tsp"),
    P("Smoked paprika", 1, "tsp"), V("Jalapeno", 1, ""), P("Vegetable broth", 2, "cup"), V("Lime", 1, "") ],
  instructions: ["Saute the aromatics and spices.",
    "Add the beans (puree some for thickness) and the broth.",
    "Simmer until thick and finish with lime.",
    "Top as desired."] });

add({ id: "slow-cooker-black-bean-soup", name: "Slow Cooker Black Bean Soup",
  description: "Set-and-forget dried black bean soup with peppers and salsa.",
  cuisine: "mexican", difficulty: "easy", prep_time: 10, cook_time: 480, total_time: 490, servings: 6,
  calories_per_serving: 294, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.85, is_one_pot: true,
  ingredients: [ P("Dried black beans", 1, "lb"), V("Onion", 1, ""), V("Carrots", 2, ""), V("Garlic", 4, "clove"),
    V("Bell pepper", 1, ""), P("Chili powder", 1, "tbsp"), P("Cumin", 1, "tsp"), P("Vegetable broth", 6, "cup"),
    P("Salsa", 1, "cup") ],
  instructions: ["Add everything to the slow cooker.",
    "Cook on low about 8 hours until the beans are very soft.",
    "Immersion-blend until thick and season."] });

add({ id: "vegetarian-15-bean-soup", name: "Vegetarian 15 Bean Soup",
  description: "Big-batch mixed bean soup seasoned from scratch, finished with cider vinegar.",
  cuisine: "american", difficulty: "easy", prep_time: 10, cook_time: 110, total_time: 120, servings: 6,
  calories_per_serving: 320, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.7, is_one_pot: true,
  ingredients: [ P("15-bean mix", 1, ""), P("Coconut oil", 1, "tbsp"), V("Onion", 1, ""), V("Garlic", 4, "clove"),
    V("Carrots", 3, ""), P("Canned diced tomatoes", 1, "can"), P("Cumin", 1, "tsp"), P("Oregano", 1, "tsp"),
    P("Smoked paprika", 1, "tsp"), P("Apple cider vinegar", 1, "tbsp") ],
  instructions: ["Saute the aromatics.",
    "Add the beans and water and simmer about 90 minutes until soft (discard the seasoning packet).",
    "Add the tomatoes and spices and simmer 20 minutes.",
    "Salt to taste and finish with apple cider vinegar."] });

add({ id: "classic-minestrone-soup-gf", name: "Classic Minestrone Soup (Gluten-Free)",
  description: "Vegetable, bean and GF-pasta minestrone in a herby tomato broth.",
  cuisine: "italian", difficulty: "easy", prep_time: 15, cook_time: 45, total_time: 60, servings: 6,
  calories_per_serving: 360, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.76, is_one_pot: true,
  ingredients: [ P("Olive oil", 4, "tbsp"), V("Yellow onion", 1, ""), V("Carrots", 2, ""), V("Celery", 2, ""),
    P("Tomato paste", 0.25, "cup"), V("Seasonal vegetables", 2, "cup"), V("Garlic", 4, "clove"),
    P("Dried oregano", 0.5, "tsp"), P("Dried thyme", 0.5, "tsp"), P("Canned diced tomatoes", 1, "can"),
    P("Vegetable broth", 4, "cup"), P("Water", 2, "cup"), P("Small gluten-free pasta", 1, "cup"),
    P("Cannellini beans", 1, "can"), V("Greens", 2, "cup"), V("Lemon", 1, "") ],
  instructions: ["Saute onion, carrot, celery and tomato paste 7 to 10 minutes.",
    "Add the seasonal vegetables, garlic and herbs 2 minutes.",
    "Add tomatoes, broth, water, salt, bay and pepper, boil then simmer 15 minutes.",
    "Add the gluten-free pasta, beans and greens and cook until the pasta is done.",
    "Remove the bay and stir in lemon and a final tablespoon of oil."] });

add({ id: "vegan-sweet-potato-peanut-stew", name: "Vegan Sweet Potato Peanut Stew",
  description: "West-African-inspired sweet potato and peanut butter stew with collards.",
  cuisine: "african", difficulty: "easy", prep_time: 10, cook_time: 30, total_time: 40, servings: 5,
  calories_per_serving: 468, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.8, is_one_pot: true,
  ingredients: [ V("Fresh ginger", 1, "tbsp"), V("Onion", 1, ""), V("Garlic", 3, "clove"),
    V("Sweet potatoes", 2, ""), P("Crushed tomatoes", 1, "can"), P("Vegetable broth", 4, "cup"),
    D("Natural peanut butter", 0.5, "cup"), V("Collard greens", 4, "cup"), P("Brown rice", 1.5, "cup"),
    D("Chopped peanuts", 0.25, "cup") ],
  instructions: ["Saute ginger, onion and garlic.",
    "Add sweet potatoes, tomatoes, broth and peanut butter and simmer 15 to 20 minutes until soft.",
    "Stir in the collards 5 minutes and smash some sweet potato to thicken; season.",
    "Serve over rice with peanuts."] });

add({ id: "slow-cooker-vegetarian-lentil-chili", name: "Slow Cooker Vegetarian Lentil Chili",
  description: "Dump-and-go brown lentil chili with a silky mouthfeel.",
  cuisine: "american", difficulty: "easy", prep_time: 10, cook_time: 240, total_time: 250, servings: 6,
  calories_per_serving: 369, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.85, is_one_pot: true,
  ingredients: [ V("Onion", 1, ""), V("Garlic", 4, "clove"), P("Brown lentils", 1.5, "cup"),
    P("Canned diced tomatoes", 1, "can"), P("Kidney beans", 1, "can"), P("Chili powder", 2, "tbsp"),
    P("Cumin", 1, "tsp"), P("Coconut oil", 1, "tbsp"), P("Vegetable broth", 4, "cup") ],
  instructions: ["Dice the onion and mince the garlic.",
    "Add all the ingredients to the slow cooker and stir.",
    "Cook on high 4 hours or low 8 hours until the lentils are tender.",
    "Salt to taste and add toppings."] });

add({ id: "homemade-vegetarian-three-bean-chili", name: "Homemade Vegetarian Three-Bean Chili",
  description: "Smoky three-bean and corn chili sweetened with a touch of molasses.",
  cuisine: "mexican", difficulty: "easy", prep_time: 10, cook_time: 30, total_time: 40, servings: 6,
  calories_per_serving: 400, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.8, is_one_pot: true,
  ingredients: [ P("Olive oil", 2, "tbsp"), V("Onion", 1, ""), V("Garlic", 3, "clove"), V("Green bell pepper", 1, ""),
    P("Tomato paste", 6, "oz"), P("Canned diced tomatoes", 1, "can"), P("Fire-roasted green chiles", 4, "oz"),
    P("Molasses", 2, "tbsp"), P("Kidney beans", 1, "can"), P("Black beans", 1, "can"), P("Pinto beans", 1, "can"),
    P("Corn", 1, "can"), P("Chili powder", 1, "tbsp"), P("Cumin", 2, "tsp") ],
  instructions: ["Dice the onion and pepper and mince the garlic.",
    "Toast the spices in a dry pot 2 to 4 minutes.",
    "Add oil, onion, garlic, pepper and salt and cook 4 to 6 minutes.",
    "Add tomato paste, tomatoes, chiles, molasses and water and simmer 5 minutes.",
    "Add the beans and corn and simmer covered 20 to 25 minutes."] });

// ---------- CATEGORY 7: Egg-based ----------
add({ id: "simple-shakshuka", name: "Simple Shakshuka",
  description: "Eggs poached in a smoky spiced tomato and pepper sauce.",
  cuisine: "middle-eastern", difficulty: "easy", prep_time: 5, cook_time: 35, total_time: 40, servings: 4,
  calories_per_serving: 300, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.78, is_one_pot: true,
  ingredients: [ P("Olive oil", 3, "tbsp"), V("Yellow onion", 1, ""), V("Red bell pepper", 1, ""),
    V("Jalapenos", 2, ""), V("Celery", 5, ""), P("Smoked paprika", 2, "tbsp"), P("Cardamom", 1.5, "tsp"),
    P("Cumin", 1, "tsp"), V("Garlic", 4, "clove"), P("Fire-roasted diced tomatoes", 1, "can"),
    P("Tomato paste", 2, "tbsp"), V("Lemon", 1, ""), D("Eggs", 3, ""), V("Parsley", 2, "tbsp") ],
  instructions: ["Heat the oven to 350F.",
    "In an oven-safe skillet saute onion, bell pepper, jalapeno, celery and all the spices 10 to 12 minutes.",
    "Add garlic, tomatoes, tomato paste, lemon and sugar and cook 10 minutes, thinning with water.",
    "Make wells and crack in the eggs.",
    "Bake 8 to 12 minutes until the whites set and top with parsley."] });

add({ id: "smoky-white-bean-shakshuka", name: "Smoky White Bean Shakshuka",
  description: "Eggs and white beans baked into a smoky tomato sauce.",
  cuisine: "middle-eastern", difficulty: "easy", prep_time: 10, cook_time: 25, total_time: 35, servings: 4,
  calories_per_serving: 360, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.8, is_one_pot: true,
  ingredients: [ P("Olive oil", 2, "tbsp"), V("Garlic", 3, "clove"), V("Onion", 1, ""),
    P("Canned tomatoes", 1, "can"), P("Smoked paprika", 1, "tsp"), P("Cumin", 1, "tsp"), P("Oregano", 1, "tsp"),
    P("Cannellini beans", 1, "can"), D("Eggs", 4, ""), V("Parsley", 2, "tbsp") ],
  instructions: ["Saute the garlic and onion.",
    "Add the tomatoes and spices and simmer 5 to 7 minutes to thicken, then salt.",
    "Stir in the drained beans.",
    "Make wells, add the eggs, cover and cook until set.",
    "Top with parsley."] });

add({ id: "ratatouille-frittata", name: "Ratatouille Frittata",
  description: "Roasted eggplant, zucchini and tomato folded into a dairy-free baked frittata.",
  cuisine: "mediterranean", difficulty: "medium", prep_time: 15, cook_time: 80, total_time: 95, servings: 8,
  calories_per_serving: 162, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.6, is_one_pot: false,
  ingredients: [ V("Eggplant", 1, ""), V("Zucchini", 1, ""), V("Onion", 1, ""), V("Grape tomatoes", 1, "pint"),
    P("Dried basil", 0.5, "tsp"), P("Dried oregano", 0.5, "tsp"), P("Olive oil", 2, "tbsp"),
    D("Eggs", 8, ""), P("Dairy-free milk", 0.25, "cup") ],
  instructions: ["Heat the oven to 400F and roast the diced eggplant, zucchini, onion and whole tomatoes with the herbs and oil about 50 minutes, stirring.",
    "Whisk the eggs with the dairy-free milk and salt and pepper and pour over the vegetables in an oven-safe skillet.",
    "Bake about 30 minutes until set."] });

add({ id: "dairy-free-vegetable-frittata", name: "Dairy-Free Vegetable Frittata",
  description: "Quick baked frittata with spinach, peppers and broccoli, made with non-dairy milk.",
  cuisine: "american", difficulty: "easy", prep_time: 10, cook_time: 20, total_time: 30, servings: 6,
  calories_per_serving: 220, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.8, is_one_pot: true,
  ingredients: [ D("Eggs", 9, ""), P("Dairy-free milk", 0.25, "cup"), V("Spinach", 2, "cup"),
    V("Red bell pepper", 1, ""), V("Red onion", 1, ""), V("Broccoli", 1, "cup"), P("Olive oil", 2, "tbsp") ],
  instructions: ["Saute the vegetables in an oven-safe skillet.",
    "Whisk the eggs with the non-dairy milk and seasoning and pour over.",
    "Bake until set, about 13 to 20 minutes."] });

// ---------- CATEGORY 8: Potato & sweet potato ----------
add({ id: "sweet-potato-black-bean-enchiladas", name: "Sweet Potato Black Bean Enchiladas",
  description: "Corn tortillas rolled around spiced sweet potato and black beans under a salsa sauce.",
  cuisine: "mexican", difficulty: "medium", prep_time: 20, cook_time: 35, total_time: 55, servings: 4,
  calories_per_serving: 430, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.62, is_one_pot: false,
  ingredients: [ P("Olive oil", 1, "tbsp"), V("Onion", 1, ""), V("Garlic", 3, "clove"), P("Cumin", 1, "tsp"),
    V("Sweet potatoes", 2, ""), P("Black beans", 2, "can"), P("Canned diced tomatoes", 1, "can"),
    P("Corn tortillas", 10, ""), P("Salsa", 1, "jar") ],
  instructions: ["Saute onion, garlic and cumin.",
    "Add sweet potato, beans and tomatoes and simmer covered 15 to 20 minutes until mashable, then mash slightly.",
    "Blend salsa with reserved beans and cumin for the sauce and spread in a dish.",
    "Warm the tortillas, fill and roll seam-down.",
    "Top with the sauce and bake until hot."] });

add({ id: "southwest-stuffed-sweet-potatoes", name: "Southwest Stuffed Sweet Potatoes",
  description: "Baked sweet potatoes stuffed with black beans and drizzled with cashew-nacho sauce.",
  cuisine: "mexican", difficulty: "medium", prep_time: 15, cook_time: 60, total_time: 75, servings: 4,
  calories_per_serving: 420, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.6, is_one_pot: false,
  ingredients: [ V("Sweet potatoes", 4, ""), P("Black beans", 1, "can"), V("Mixed vegetables", 2, "cup"),
    P("Cumin", 1, "tsp"), D("Cashews", 0.75, "cup"), P("Green chiles", 4, "oz"), V("Lemon", 1, ""),
    V("Jalapenos", 1, ""), V("Cilantro", 0.25, "cup") ],
  instructions: ["Bake the sweet potatoes at 425F about 45 to 60 minutes.",
    "Make the black bean and vegetable filling.",
    "Blend the cashews, water, green chiles, lemon juice and jalapenos into a sauce.",
    "Split the potatoes, fluff, fill, drizzle the sauce and garnish with cilantro."] });

add({ id: "mexican-sweet-potato-hash", name: "Mexican Sweet Potato Hash with Black Beans and Spinach",
  description: "Quick skillet hash of sweet potato, black beans and spinach, great with a fried egg.",
  cuisine: "mexican", difficulty: "easy", prep_time: 10, cook_time: 20, total_time: 30, servings: 3,
  calories_per_serving: 330, is_vegetarian: true, is_pescatarian: true, primary_protein: "none",
  ease_score: 0.82, is_one_pot: true,
  ingredients: [ P("Olive oil", 2, "tbsp"), V("Sweet potatoes", 2, ""), V("Shallot", 1, ""),
    P("Black beans", 1, "can"), P("Cumin", 1, "tsp"), P("Chili powder", 1, "tsp"), V("Spinach", 3, "cup"),
    V("Lime", 1, ""), D("Eggs", 3, "") ],
  instructions: ["Cook the diced sweet potatoes in the oil over medium-high about 15 minutes until tender.",
    "Add the shallot, beans, salt, cumin and chili powder and saute 3 minutes.",
    "Fold in the spinach to wilt and finish with lime.",
    "Top with a fried egg if you like."] });

// ---------- merge ----------
const path = "./seed/recipes.seed.json";
const existing = JSON.parse(readFileSync(path, "utf8"));
const have = new Set(existing.map((r) => r.id));
const fresh = R.filter((r) => !have.has(r.id));
const dupes = R.filter((r) => have.has(r.id)).map((r) => r.id);
const out = existing.concat(fresh);
writeFileSync(path, JSON.stringify(out, null, 2));
console.log(`Curated recipes authored: ${R.length}`);
if (dupes.length) console.log(`Skipped (already present): ${dupes.join(", ")}`);
console.log(`Appended: ${fresh.length}. Total now: ${out.length}.`);
