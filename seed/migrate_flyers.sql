CREATE TABLE IF NOT EXISTS flyers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL DEFAULT 'me',
  store_id TEXT, store_name TEXT, valid_from TEXT, valid_to TEXT,
  summary TEXT, item_count INTEGER, deals TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
