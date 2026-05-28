#!/usr/bin/env python3
"""
import_recipes.py — clean + enrich the raw cookbook JSON into the v1 seed.

Input : cookbook_recipes_final.json  (664 raw records, two merged sources)
Output: recipes.seed.json            (clean lunch/dinner mains, enriched)
        recipes_rejected.json        (broken / needs Gemini normalisation later)
        import_report.txt            (human-readable summary)

Run:  python3 import_recipes.py cookbook_recipes_final.json ./out
"""
import json, re, sys, os, collections
from datetime import datetime

KNOWN_CATS = {"pantry", "produce", "meat", "dairy", "seafood", "frozen"}

# ---- unit normalisation (for later shopping-list aggregation) --------------
UNIT_MAP = {
    "tablespoon": "tbsp", "tablespoons": "tbsp", "tbsp": "tbsp", "tbsps": "tbsp",
    "teaspoon": "tsp", "teaspoons": "tsp", "tsp": "tsp", "tsps": "tsp",
    "cup": "cup", "cups": "cup",
    "pound": "lb", "pounds": "lb", "lb": "lb", "lbs": "lb",
    "ounce": "oz", "ounces": "oz", "oz": "oz",
    "gram": "g", "grams": "g", "g": "g", "kg": "kg",
    "ml": "ml", "l": "l", "liter": "l", "litre": "l",
    "clove": "clove", "cloves": "clove",
    "unit": "", "units": "", "": "",
    "large": "", "medium": "", "small": "",
}
def norm_unit(u: str) -> str:
    return UNIT_MAP.get((u or "").strip().lower(), (u or "").strip().lower())

# ---- protein detection ------------------------------------------------------
PROTEIN_KEYWORDS = [
    ("turkey", ["turkey"]),
    ("chicken", ["chicken"]),
    ("pork", ["pork", "bacon", "pancetta", "ham", "chorizo", "prosciutto",
              "sausage", "salami", "pepperoni", "gammon"]),
    ("beef", ["beef", "brisket", "steak", "chuck", "mince", "meatball"]),
    ("lamb", ["lamb", "mutton", "shank"]),
    ("duck", ["duck"]),
    ("fish", ["salmon", "tuna", "cod", "shrimp", "prawn", "fish", "haddock",
              "tilapia", "sardine", "mackerel", "seafood", "crab", "scallop",
              "squid", "octopus", "anchov", "trout", "herring"]),
]
def detect_protein(ings):
    found = set()
    has_meat = any(i.get("category") == "meat" for i in ings)
    has_sea  = any(i.get("category") == "seafood" for i in ings)
    for i in ings:
        if i.get("category") not in ("meat", "seafood"):
            continue
        n = (i.get("name") or "").lower()
        for label, kws in PROTEIN_KEYWORDS:
            if any(k in n for k in kws):
                found.add(label)
    if not found:
        # category says animal protein but no keyword matched -> don't mislabel as veg
        if has_sea:  return "fish"
        if has_meat: return "other"
        return "none"
    if len(found) == 1:
        return found.pop()
    for p in ("chicken", "beef", "pork", "turkey", "lamb", "duck", "fish"):
        if p in found:
            return p
    return "mixed"

# Animal words that, if present in the NAME, mean the dish is not vegetarian
# even when the ingredient list dropped/truncated the protein.
NAME_MEAT = ["chicken", "beef", "pork", "bacon", "sausage", "lamb", "duck",
             "turkey", "ham", "brisket", "steak", "mince", "chorizo", "gyro",
             "kebab", "carnitas", "meatball", "schnitzel", "bolognese", "ragu",
             "pepperoni", "prosciutto", "pancetta", "veal", "venison"]
NAME_SEAFOOD = ["salmon", "tuna", "cod", "shrimp", "prawn", "fish", "haddock",
                "mackerel", "sardine", "crab", "scallop", "squid", "anchovy",
                "trout", "seafood", "calamari"]

def name_protein(name):
    n = (name or "").lower()
    for label, kws in PROTEIN_KEYWORDS:
        if any(k in n for k in kws):
            return label
    if any(k in n for k in NAME_MEAT):    return "other"
    if any(k in n for k in NAME_SEAFOOD): return "fish"
    return None

# ---- ease score + one-pot detection ----------------------------------------
ONE_POT_HINTS = ["sheet pan", "sheet-pan", "skillet", "one pot", "one-pot",
                 "slow cooker", "slow-cooker", "casserole", "bake", "tray bake",
                 "instant pot", "dump"]
def is_one_pot(name, instructions):
    blob = (name + " " + " ".join(instructions)).lower()
    return any(h in blob for h in ONE_POT_HINTS)

def ease_score(difficulty, total_time, n_steps, one_pot):
    diff = 1.0 if difficulty == "easy" else 0.6
    if total_time <= 20:   t = 1.0
    elif total_time <= 35: t = 0.75
    elif total_time <= 60: t = 0.45
    else:                  t = 0.2
    steps = 1.0 if n_steps <= 5 else 0.7 if n_steps <= 9 else 0.45
    base = 0.45 * t + 0.30 * diff + 0.25 * steps
    if one_pot:
        base = min(1.0, base + 0.08)   # fewer dishes = busy-family friendly
    return round(base, 3)

# ---- cleaning ---------------------------------------------------------------
def real_ingredients(ings):
    out = []
    for i in ings:
        n = (i.get("name") or "").strip()
        if not n:
            continue
        if any(t in n for t in ["|", "MINUTES", "PREP", "SLOW COOK"]):
            continue  # header junk captured as ingredient
        out.append(i)
    return out

NONPANTRY = {"meat", "produce", "dairy", "seafood", "frozen"}

def is_truly_structured(r):
    """The reliable tell between the two merged sources: the clean source
    categorises ingredients (meat/produce/...) and gives real quantities; the
    messy cookbook source dumps everything into 'pantry' with quantity 0."""
    ings = r["ingredients"]
    has_cat = any(i.get("category") in NONPANTRY for i in ings)
    has_qty = any((i.get("quantity") or 0) > 0 for i in ings)
    return has_cat and has_qty

def reject_reason(r):
    n = r["name"].strip()
    if r.get("meal_type") in ("breakfast", "dessert"):     return "not-lunch-dinner"
    if re.fullmatch(r"\d+\s*to", n) or len(n) < 3:          return "fragment-name"
    if n.count(" ") > 9:                                    return "sentence-as-name"
    if not is_truly_structured(r):                          return "uncategorised-source"
    return None  # keep

def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:80] or "recipe"

def enrich_record(r, seen_slugs, source=None):
    """Turn a raw record whose ingredients are ALREADY structured+categorised
    ({name, quantity, unit, category}) into an enriched seed record.
    Shared by the importer and the rescue script so derivations stay identical."""
    ings = []
    for i in real_ingredients(r["ingredients"]):
        ings.append({
            "name": (i.get("name") or "").strip(),
            "quantity": i.get("quantity") or None,
            "unit": (i.get("unit") or "").strip(),
            "unit_norm": norm_unit(i.get("unit")),
            "category": i.get("category") if i.get("category") in KNOWN_CATS else "pantry",
        })
    has_meat    = any(i["category"] == "meat" for i in ings)
    has_seafood = any(i["category"] == "seafood" for i in ings)
    has_dairy   = any(i["category"] == "dairy" for i in ings)

    # Name-based guard: the dish name is reliable even when the ingredient list
    # dropped or truncated the protein (e.g. "...Chicken Breasts" whose only
    # protein ingredient survived as "boneless").
    nm_prot = name_protein(r["name"])
    nm_meat = nm_prot in ("chicken", "beef", "pork", "turkey", "lamb", "duck", "other")
    nm_sea  = nm_prot == "fish"

    cook = r.get("cook_time") or 0
    prep = r.get("prep_time") or 0
    total = cook + prep
    one_pot = is_one_pot(r["name"], r.get("instructions", []))

    base = slugify(r["name"])
    seen_slugs[base] += 1
    rid = base if seen_slugs[base] == 1 else f"{base}-{seen_slugs[base]}"

    return {
        "id": rid,
        "name": r["name"].strip(),
        "description": (r.get("description") or "").strip(),
        "cuisine": r.get("cuisine"),
        "meal_type": r.get("meal_type"),
        "difficulty": r.get("difficulty"),
        "cook_time": cook,
        "prep_time": prep or None,
        "total_time": total,
        "servings": r.get("servings") or 4,
        "calories_per_serving": r.get("calories_per_serving"),
        "is_gluten_free": bool(r.get("is_gluten_free")),
        "is_vegetarian": not (has_meat or has_seafood or nm_meat or nm_sea),
        "is_pescatarian": not (has_meat or nm_meat) and (has_seafood or nm_sea),
        "is_dairy_free": not has_dairy,
        "contains_dairy": has_dairy,
        "primary_protein": (detect_protein(ings)
                            if detect_protein(ings) not in ("none", "other") or not nm_prot
                            else nm_prot),
        "ease_score": ease_score(r.get("difficulty"), total,
                                 len(r.get("instructions", [])), one_pot),
        "ingredient_count": len(ings),
        "is_one_pot": one_pot,
        "ingredients": ings,
        "instructions": r.get("instructions", []),
        "source": source,
    }

# ---- main -------------------------------------------------------------------
def main(src, outdir):
    os.makedirs(outdir, exist_ok=True)
    data = json.load(open(src, encoding="utf-8"))

    seed, rejected = [], []
    reasons = collections.Counter()
    seen_slugs = collections.Counter()

    for r in data:
        why = reject_reason(r)
        if why:
            reasons[why] += 1
            rejected.append({"name": r.get("name"), "reason": why, "raw": r})
            continue

        seed.append(enrich_record(r, seen_slugs, source=None))

    json.dump(seed, open(os.path.join(outdir, "recipes.seed.json"), "w",
              encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(rejected, open(os.path.join(outdir, "recipes_rejected.json"), "w",
              encoding="utf-8"), ensure_ascii=False, indent=2)

    # report
    lines = []
    lines.append(f"Import run: {datetime.now().isoformat(timespec='seconds')}")
    lines.append(f"Source records: {len(data)}")
    lines.append(f"  -> seed (clean lunch/dinner mains): {len(seed)}")
    lines.append(f"  -> rejected: {len(rejected)}")
    for k, v in reasons.most_common():
        lines.append(f"       {k}: {v}")
    lines.append("")
    lines.append("Seed breakdown:")
    lines.append("  cuisine: " + ", ".join(f"{k}={v}" for k, v in
                 collections.Counter(s["cuisine"] for s in seed).most_common()))
    lines.append("  protein: " + ", ".join(f"{k}={v}" for k, v in
                 collections.Counter(s["primary_protein"] for s in seed).most_common()))
    lines.append(f"  gluten_free: {sum(s['is_gluten_free'] for s in seed)}")
    lines.append(f"  vegetarian:  {sum(s['is_vegetarian'] for s in seed)}")
    lines.append(f"  pescatarian: {sum(s['is_pescatarian'] for s in seed)}")
    lines.append(f"  dairy_free:  {sum(s['is_dairy_free'] for s in seed)}")
    lines.append(f"  one_pot/sheet/slow: {sum(s['is_one_pot'] for s in seed)}")
    avg_ease = sum(s["ease_score"] for s in seed) / max(len(seed), 1)
    lines.append(f"  avg ease_score: {avg_ease:.2f}")
    report = "\n".join(lines)
    open(os.path.join(outdir, "import_report.txt"), "w").write(report)
    print(report)

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "cookbook_recipes_final.json"
    out = sys.argv[2] if len(sys.argv) > 2 else "./out"
    main(src, out)
