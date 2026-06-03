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
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

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
  status     TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, week_start)
);

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id     INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,    -- 1=Mon..7=Sun
  slot        TEXT NOT NULL,       -- lunch | dinner
  recipe_id   TEXT,
  is_leftover INTEGER NOT NULL DEFAULT 0,
  leftover_of INTEGER,
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
  user_id     TEXT NOT NULL DEFAULT 'me',
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
