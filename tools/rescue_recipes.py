#!/usr/bin/env python3
"""
rescue_recipes.py — recover recipes the importer set aside, WITHOUT an LLM.

The big rejected bucket ("uncategorised-source") is real recipes that only lack
ingredient categories (and sometimes inline-parsed quantities). Both are
recoverable deterministically:
  * categorise each ingredient by keyword  -> makes diet flags reliable
  * parse "350g carrots" / "2 × 120g chicken breasts" -> qty + unit + clean name

Recipes whose *name* is a cookbook anecdote ("Whenever I've visited the Greek
islands...") or a fragment ("4 to") can't be named without an LLM, so they are
written to recipes_needs_gemini.json WITH their ingredients already parsed, so
the later Gemini pass only has to supply a dish name (cheap).

Run:  python3 rescue_recipes.py cookbook_recipes_final.json ./out
"""
import json, re, sys, os, collections
from datetime import datetime
from import_recipes import (enrich_record, reject_reason, real_ingredients,
                            norm_unit, detect_protein, KNOWN_CATS)

# ---- unicode fractions ------------------------------------------------------
FRAC = {"½": .5, "¼": .25, "¾": .75, "⅓": 1/3, "⅔": 2/3,
        "⅛": .125, "⅜": .375, "⅝": .625, "⅞": .875}
def defrac(s):
    for g, v in FRAC.items():
        s = s.replace(g, f" {v} ")
    return s

# ---- ingredient categoriser (keyword) --------------------------------------
SEAFOOD = ["salmon", "tuna", "cod", "shrimp", "prawn", "mackerel", "sardine",
           "anchov", "crab", "scallop", "squid", "octopus", "haddock",
           "sea bass", "seabass", "trout", "herring", "pollock", "tilapia", "fish"]
MEAT = ["chicken", "beef", "pork", "bacon", "sausage", "turkey", "lamb", "duck",
        "ham", "chorizo", "brisket", "pancetta", "prosciutto", "bresaola",
        "veal", "mutton", "salami", "pepperoni", "mince", "steak", "meatball"]
DAIRY = ["milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "feta",
         "mozzarella", "parmesan", "parmigiano", "manchego", "mascarpone",
         "ricotta", "ghee", "paneer", "halloumi", "custard", "crème fraîche",
         "creme fraiche", "buttermilk", "curd"]
DAIRY_FALSE = ["coconut", "almond", "soy", "soya", "oat ", "peanut", "cashew",
               "cocoa", "nut butter", "shea"]
PRODUCE = ["onion", "garlic", "tomato", "pepper", "carrot", "potato", "spinach",
           "lettuce", "broccoli", "courgette", "zucchini", "aubergine",
           "eggplant", "cucumber", "mushroom", "lemon", "lime", "orange",
           "apple", "pear", "banana", "mango", "avocado", "lentil", "bean",
           "pea", "kale", "cabbage", "leek", "celery", "beet", "squash",
           "pumpkin", "chilli", "chili", "ginger", "herb", "mint", "parsley",
           "coriander", "cilantro", "basil", "rocket", "watercress", "cress",
           "fennel", "asparagus", "okra", "corn", "berr", "grape", "pomegranate",
           "scallion", "shallot", "radish", "cauliflower", "chard", "sprout",
           "arugula", "spring onion", "yam", "sweet potato", "olive", "caper",
           "artichoke", "turnip", "parsnip", "plantain", "date", "fig", "cherry",
           "peach", "plum", "apricot", "melon", "pineapple", "kiwi", "kale",
           "courgett", "aubergin", "spring green", "samphire", "endive", "chive"]

# names that contain a meat/seafood keyword but are NOT animal products
CAT_FALSE = ["lamb's lettuce", "lambs lettuce", "beef tomato", "beefsteak",
             "scalloped", "fish sauce", "oyster sauce", "oyster mushroom",
             "mock ", "vegan ", "veggie ", "plant-based", "meatless", "meat-free",
             "chicken of the woods", "chickpea"]

def categorise(name):
    n = name.lower()
    if any(f in n for f in CAT_FALSE):
        # still let produce/dairy keywords apply, but block meat/seafood
        if any(d in n for d in DAIRY) and not any(x in n for x in DAIRY_FALSE):
            return "dairy"
        if any(p in n for p in PRODUCE):
            return "produce"
        return "pantry"
    # broth/stock: meat only if it names a meat, else pantry
    if "broth" in n or "stock" in n:
        return "meat" if any(m in n for m in ("chicken", "beef", "pork", "turkey", "bone")) else "pantry"
    if any(s in n for s in SEAFOOD):      return "seafood"
    if any(m in n for m in MEAT):         return "meat"
    if any(d in n for d in DAIRY) and not any(x in n for x in DAIRY_FALSE):
        return "dairy"
    if any(p in n for p in PRODUCE):      return "produce"
    return "pantry"

# ---- inline quantity/unit parser -------------------------------------------
UNIT_TOKENS = (r"kg|g|ml|l|oz|lb|lbs|cup|cups|tbsp|tsp|tablespoons?|teaspoons?|"
               r"bunch|punnet|clove|cloves|tin|tins|jar|jars|packet|pack|can|cans|"
               r"sprig|sprigs|pinch|handful|head|heads|slice|slices|rasher|rashers|stick|sticks")

def parse_ingredient_string(s):
    """Return (quantity, unit, clean_name) parsed from a free-text ingredient."""
    raw = defrac(s).strip()
    # drop leading list bullets / 'x ×'
    work = raw
    qty = None
    unit = ""
    # leading quantity (take first number, ignore ranges like 1-2)
    m = re.match(r"^\s*(\d+(?:\.\d+)?)", work)
    if m:
        qty = float(m.group(1))
        work = work[m.end():]
    # "× 250g" package size right after qty -> drop it, keep qty as count
    work = re.sub(r"^\s*[x×]\s*\d+(?:\.\d+)?\s*(?:kg|g|ml|l|oz|lb)?", "", work, flags=re.I)
    # unit immediately after number, possibly glued ("350g") — re-check from raw
    mg = re.match(r"^\s*\d+(?:\.\d+)?\s*(kg|g|ml|l|oz)\b", raw, flags=re.I)
    if mg:
        unit = norm_unit(mg.group(1))
    else:
        mu = re.match(rf"^\s*({UNIT_TOKENS})\b", work, flags=re.I)
        if mu:
            unit = norm_unit(mu.group(1))
            work = work[mu.end():]
    # tidy name: strip leading 'a/of/the', parentheticals, glued unit, punctuation
    name = work
    name = re.sub(r"^\s*(of|a|the)\s+", "", name, flags=re.I)
    name = re.sub(r"^\s*(kg|g|ml|l|oz)\b", "", name, flags=re.I)  # glued unit leftover
    name = re.sub(r"\([^)]*\)", "", name)            # remove "(300g)"
    name = re.sub(r"\s*[x×]\s*\d+\S*", "", name)      # remove "× 120g"
    name = re.sub(r"[,;].*$", "", name)               # drop ", trimmed" etc. tail
    name = re.sub(r"\s+", " ", name).strip(" -–—:")
    return qty, unit, name or raw

# ---- name generation (for recipes whose source name is an anecdote/fragment)
NAME_ADJ = {"mixed-colour", "mixed", "colour", "ripe", "small", "large", "medium",
            "fine", "fresh", "baby", "quality", "sliced", "chopped", "ground",
            "whole", "heaped", "tablespoon", "teaspoon", "tablespoons", "teaspoons",
            "of", "a", "the", "unsalted", "shelled", "podded", "frozen", "dried",
            "raw", "cooked", "skinless", "boneless", "natural", "seasonal",
            "free-range", "organic", "good", "trimmed", "rinsed", "halved",
            "wheel", "ball", "bunch", "punnet", "packet", "jar", "tin", "sprigs"}

NON_HERO = {"butter", "brine", "juice", "oil", "stock", "broth", "water",
            "sauce", "syrup", "sugar", "flour", "paste", "powder", "vinegar",
            "wine", "salt", "pepper", "seasoning", "dressing", "mayo", "mustard",
            "honey", "jam", "stock", "cube", "extract", "zest", "rind", "leaves",
            "leaf", "mix", "blend", "spread", "dust", "drizzle", "bread", "pitta",
            "pittas", "wrap", "tortilla", "bun", "roll",
            "in", "with", "or", "and", "from", "plus", "to", "into", "on", "for"}
PROTEIN_LABEL = {"chicken": "Chicken", "beef": "Beef", "pork": "Pork",
                 "turkey": "Turkey", "lamb": "Lamb", "duck": "Duck",
                 "fish": "Fish", "other": None, "none": None, "mixed": None}

def _clean_word(ing_name):
    words = re.sub(r"[^a-zA-Z' -]", " ", ing_name.lower()).split()
    words = [w for w in words if w not in NAME_ADJ and w not in NON_HERO]
    if not words:
        return None
    keep2 = len(words) >= 2 and words[-2] in ("goat's", "cherry", "spring", "green", "red")
    return " ".join(words[-2:] if keep2 else words[-1:]).title()

def generate_name(ings, instructions, protein="none"):
    """Lead with the detected protein, then add produce/dairy heroes."""
    picks, seen = [], set()
    lead = PROTEIN_LABEL.get(protein)
    if lead:
        picks.append(lead); seen.add(lead.lower())
    order = {"produce": 0, "dairy": 1, "seafood": 2, "meat": 3, "pantry": 4}
    for i in sorted(ings, key=lambda i: order.get(i["category"], 4)):
        if i["category"] == "pantry" and picks:
            continue
        w = _clean_word(i["name"])
        if w and w.lower() not in seen:
            picks.append(w); seen.add(w.lower())
        if len(picks) == 3:
            break
    if not picks:
        return "House Recipe"
    blob = " ".join(instructions).lower()
    kind = "Salad" if ("salad" in blob or "toss" in blob) else "Bowl" if "bowl" in blob else ""
    base = " & ".join(picks) if len(picks) <= 2 else f"{picks[0]}, {picks[1]} & {picks[2]}"
    return f"{base} {kind}".strip()

def name_is_good(n):
    n = (n or "").strip()
    return len(n) >= 3 and n.count(" ") <= 9 and not re.fullmatch(r"\d+\s*to", n)

def is_junk_line(name):
    n = (name or "").strip()
    if not n:
        return True
    if any(t in n for t in ["|", "MINUTES", "PREP", "SLOW COOK", "FAST PREP"]):
        return True
    # all-caps metadata/tag line, e.g. "MEATLESS, DAIRY-FREE, GLUTEN-FREE"
    letters = [c for c in n if c.isalpha()]
    if letters and all(c.isupper() for c in letters) and ("," in n or "-FREE" in n.upper()):
        return True
    return False

def normalise_ingredients(ings):
    """Make every ingredient {name, quantity, unit, category}. Parse the inline
    string only when quantity is missing (sub-pattern 2); otherwise just
    categorise (sub-pattern 1). Junk/metadata lines are dropped."""
    out = []
    for i in ings:
        nm = (i.get("name") or "").strip()
        if is_junk_line(nm):
            continue
        q = i.get("quantity") or 0
        if q and q > 0:
            qty, unit, name = i.get("quantity"), (i.get("unit") or ""), nm
        else:
            qty, unit, name = parse_ingredient_string(nm)
        out.append({"name": name, "quantity": qty, "unit": unit,
                    "category": categorise(name)})
    return out

# ---- main -------------------------------------------------------------------
def main(src, outdir):
    os.makedirs(outdir, exist_ok=True)
    data = json.load(open(src, encoding="utf-8"))
    seen = collections.Counter()
    seed, needs_gemini = [], []
    counts = collections.Counter()

    for r in data:
        why = reject_reason(r)
        if why == "not-lunch-dinner":
            counts["dropped_breakfast_dessert"] += 1
            continue
        if why is None:
            seed.append(enrich_record(r, seen, source="clean"))
            counts["clean"] += 1
            continue

        # every messy bucket: normalise ingredients, then decide if salvageable
        fixed = dict(r)
        fixed["ingredients"] = normalise_ingredients(r["ingredients"])
        usable = [i for i in fixed["ingredients"] if i["name"] and len(i["name"]) > 1]
        if len(usable) < 2:
            counts["dropped_unsalvageable"] += 1   # source lost the ingredients; nothing to recover
            continue

        if name_is_good(r["name"]):
            fixed["name"] = r["name"]
            src = "rescued-deterministic"
        else:
            fixed["name"] = generate_name(fixed["ingredients"],
                                           r.get("instructions", []),
                                           detect_protein(fixed["ingredients"]))
            src = "rescued-named"
        seed.append(enrich_record(fixed, seen, source=src))
        counts[src] += 1

    # Cuisine cleanup: keep only meaningful, well-represented cuisines; null the
    # vague/source-artifact ones (british, modern) and the rare tail. "Not every
    # recipe needs a label."
    KEEP_CUISINES = {"mediterranean", "american", "mexican", "asian", "italian"}
    for r in seed:
        if r.get("cuisine") not in KEEP_CUISINES:
            r["cuisine"] = None

    json.dump(seed, open(os.path.join(outdir, "recipes.seed.json"), "w",
              encoding="utf-8"), ensure_ascii=False, indent=2)

    lines = [f"Rescue run: {datetime.now().isoformat(timespec='seconds')}",
             f"Source records: {len(data)}",
             f"  clean (kept as-is):              {counts['clean']}",
             f"  rescued (good name, recategorised): {counts['rescued-deterministic']}",
             f"  rescued (name generated):        {counts['rescued-named']}",
             f"  -> SEED TOTAL:                   {len(seed)}",
             f"  dropped (breakfast/dessert):     {counts['dropped_breakfast_dessert']}",
             f"  dropped (source lost ingredients): {counts['dropped_unsalvageable']}",
             "",
             "Seed by source: " + ", ".join(f"{k}={v}" for k, v in
                 collections.Counter(s.get("source") for s in seed).most_common()),
             "Seed diet/protein breakdown:",
             "  protein: " + ", ".join(f"{k}={v}" for k, v in
                 collections.Counter(s["primary_protein"] for s in seed).most_common()),
             f"  vegetarian:  {sum(s['is_vegetarian'] for s in seed)}",
             f"  pescatarian: {sum(s['is_pescatarian'] for s in seed)}",
             f"  gluten_free: {sum(s['is_gluten_free'] for s in seed)}",
             f"  dairy_free:  {sum(s['is_dairy_free'] for s in seed)}",
             f"  one_pot:     {sum(s['is_one_pot'] for s in seed)}",
             "  cuisine: " + ", ".join(f"{k}={v}" for k, v in
                 collections.Counter(s["cuisine"] for s in seed).most_common())]
    rep = "\n".join(lines)
    open(os.path.join(outdir, "rescue_report.txt"), "w").write(rep)
    print(rep)

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "cookbook_recipes_final.json"
    out = sys.argv[2] if len(sys.argv) > 2 else "./out"
    main(src, out)
