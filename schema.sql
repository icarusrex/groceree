-- Groceree — Cloudflare D1 (SQLite) schema.
-- Ported from the Postgres draft: booleans -> INTEGER 0/1, arrays/json -> TEXT
-- (JSON), timestamptz -> TEXT (ISO), identity -> INTEGER PRIMARY KEY AUTOINCREMENT.
--
-- user_id is supplied by the Pages Function from the Cloudflare Access header
-- (Cf-Access-Authenticated-User-Email), falling back to 'me'. So per-person data
-- is free once Access is on, with no auth code in the app.

-- ============================ SHARED: recipes ============================
CREATE TABLE IF NOT EXISTS recipes (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  description          TEXT,
  cuisine              TEXT,
  difficulty           TEXT,
  cook_time            INTEGER,
  prep_time            INTEGER,
  total_time           INTEGER,
  servings             INTEGER NOT NULL DEFAULT 4,
  calories_per_serving INTEGER,
  is_gluten_free       INTEGER NOT NULL DEFAULT 0,
  is_vegetarian        INTEGER NOT NULL DEFAULT 0,
  is_pescatarian       INTEGER NOT NULL DEFAULT 0,
  is_dairy_free        INTEGER NOT NULL DEFAULT 0,
  contains_dairy       INTEGER NOT NULL DEFAULT 0,
  primary_protein      TEXT,
  cost_tier            INTEGER NOT NULL DEFAULT 2,   -- 1 cheap … 4 premium
  ease_score           REAL NOT NULL DEFAULT 0.5,
  ingredient_count     INTEGER NOT NULL DEFAULT 0,
  is_one_pot           INTEGER NOT NULL DEFAULT 0,
  ingredients          TEXT NOT NULL DEFAULT '[]',   -- JSON
  instructions         TEXT NOT NULL DEFAULT '[]',   -- JSON
  source               TEXT,
  image_url            TEXT
);
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine on recipes(cuisine);
CREATE INDEX IF NOT EXISTS idx_recipes_protein on recipes(primary_protein);
CREATE INDEX IF NOT EXISTS idx_recipes_veg     on recipes(is_vegetarian);

-- ===================== PERSONAL: learning core ==========================
CREATE TABLE IF NOT EXISTS recipe_state (
  user_id        TEXT NOT NULL DEFAULT 'me',
  recipe_id      TEXT NOT NULL,
  is_favorite    INTEGER NOT NULL DEFAULT 0,
  is_hidden      INTEGER NOT NULL DEFAULT 0,
  times_cooked   INTEGER NOT NULL DEFAULT 0,
  times_skipped  INTEGER NOT NULL DEFAULT 0,
  last_cooked_at TEXT,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE TABLE IF NOT EXISTS recipe_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL DEFAULT 'me',
  recipe_id  TEXT NOT NULL,
  signal     TEXT NOT NULL,   -- favorite|unfavorite|hide|unhide|cooked|skipped|added
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_recipe on recipe_events(user_id, recipe_id);

-- ===================== PERSONAL: settings ===============================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id            TEXT PRIMARY KEY,
  household_size     INTEGER NOT NULL DEFAULT 2,
  diet               TEXT NOT NULL DEFAULT '[]',      -- JSON array
  exclude_cuisines   TEXT NOT NULL DEFAULT '[]',      -- JSON array
  max_active_minutes INTEGER,
  leftover_strategy  TEXT NOT NULL DEFAULT 'auto',
  plan_days          INTEGER NOT NULL DEFAULT 4,      -- meals to generate (4 or 7)
  selected_stores    TEXT NOT NULL DEFAULT '[]',      -- JSON array of store ids; [] = all
  country            TEXT NOT NULL DEFAULT 'PT',      -- which country's stores to show (PT/CZ)
  notion_parent_id   TEXT,                            -- Notion page the shopping list exports into
  monthly_food_budget REAL,                           -- € / month; plan + receipts compare against it
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
-- NOTE: this file is CREATE TABLE IF NOT EXISTS throughout, so a column added
-- here does NOT reach a database that already exists. For those, run once:
--   npx wrangler d1 execute groceree --remote \
--     --command "ALTER TABLE user_settings ADD COLUMN notion_parent_id TEXT"
-- (and the same with --local for the dev database).

-- ===================== PERSONAL: pantry =================================
CREATE TABLE IF NOT EXISTS pantry_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL DEFAULT 'me',
  raw_text   TEXT NOT NULL,
  name       TEXT,
  quantity   REAL,
  unit       TEXT,
  category   TEXT,
  source     TEXT NOT NULL DEFAULT 'manual',  -- manual | photo
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pantry_user on pantry_items(user_id);

-- ===================== PERSONAL: meal plans =============================
CREATE TABLE IF NOT EXISTS meal_plans (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL DEFAULT 'me',
  week_start TEXT NOT NULL,
  start_date TEXT,
  plan_days INTEGER NOT NULL DEFAULT 4,
  status     TEXT NOT NULL DEFAULT 'draft',
  revision   INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, week_start)
);

CREATE TABLE IF NOT EXISTS active_meal_plans (
  user_id TEXT PRIMARY KEY,
  plan_id INTEGER REFERENCES meal_plans(id),
  revision INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id     INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,    -- 1=Mon..7=Sun
  slot        TEXT NOT NULL,       -- lunch | dinner
  recipe_id   TEXT,
  is_leftover INTEGER NOT NULL DEFAULT 0,
  leftover_of TEXT,                -- JSON {day_of_week,slot}; also works in existing SQLite INTEGER columns
  servings    INTEGER,
  position    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (plan_id, day_of_week, slot)
);

-- ============== SHARED (dormant in v1): flyer / price seam ==============
CREATE TABLE IF NOT EXISTS stores (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS store_prices (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id     TEXT NOT NULL REFERENCES stores(id),
  country      TEXT NOT NULL DEFAULT 'PT',   -- prices are shared per country
  item_name    TEXT NOT NULL,
  item_name_pt TEXT,
  unit         TEXT,
  price        REAL,
  normal_price REAL,
  discount     REAL,           -- 0..1
  currency     TEXT NOT NULL DEFAULT 'EUR',
  valid_from   TEXT,
  valid_to     TEXT,
  source       TEXT,           -- 'flyer:aldi:2026-02-07'
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prices_item  on store_prices(item_name);
CREATE INDEX IF NOT EXISTS idx_prices_valid on store_prices(valid_from, valid_to);

-- Uploaded flyers (one row per flyer upload), with validity window + summary.
CREATE TABLE IF NOT EXISTS flyers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL DEFAULT 'me',   -- who last fetched it (audit)
  country     TEXT NOT NULL DEFAULT 'PT',   -- flyers are shared per country
  store_id    TEXT,
  store_name  TEXT,
  valid_from  TEXT,
  valid_to    TEXT,
  summary     TEXT,          -- short overview of notable deals / theme
  item_count  INTEGER,
  deals       TEXT,          -- JSON: {itemName: discount} good-value only
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_flyers_user on flyers(user_id);

-- Staple basket: user-logged REGULAR (non-promo) shelf prices for a fixed set of
-- staples they actually buy, per store. The only honest cross-store price-level
-- signal — same item compared like-for-like, immune to flyer product-mix skew.
CREATE TABLE IF NOT EXISTS basket_prices (
  user_id    TEXT NOT NULL DEFAULT 'me',
  item       TEXT NOT NULL,
  store      TEXT NOT NULL,
  price      REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item, store)
);

-- ============== Price book: one live unit price per ingredient ==============
-- item = the canonical ingredient name the shopping list uses (toBuyItem), so a
-- recipe line prices by arithmetic. Two sources, kept side by side:
--   'shelf'   — Auchan's online shop (regular price per kg/L), refreshed monthly
--   'receipt' — what you actually paid (overrides shelf while recent)
-- A shelf row with no price marks "searched, not found" so it isn't retried daily.
CREATE TABLE IF NOT EXISTS price_book (
  country    TEXT NOT NULL DEFAULT 'PT',
  item       TEXT NOT NULL,
  source     TEXT NOT NULL,       -- shelf | receipt
  per_kg     REAL,                -- € per kg (or per litre)
  per_item   REAL,                -- € per piece, for things sold by count
  store      TEXT,
  product    TEXT,                -- what was matched, for sanity checks
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (country, item, source)
);

-- One row per scanned receipt: the trip total, for month-to-date food spend.
CREATE TABLE IF NOT EXISTS receipts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL DEFAULT 'me',
  country       TEXT NOT NULL DEFAULT 'PT',
  store         TEXT,
  date          TEXT NOT NULL,     -- purchase date YYYY-MM-DD
  total         REAL,              -- amount paid (whole bill)
  grocery_total REAL,              -- sum of the food/grocery lines
  item_count    INTEGER,
  source        TEXT,              -- matches store_prices.source for its lines
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_receipts_user_date on receipts(user_id, date);

