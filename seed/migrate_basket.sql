CREATE TABLE IF NOT EXISTS basket_prices (
  user_id    TEXT NOT NULL DEFAULT 'me',
  item       TEXT NOT NULL,
  store      TEXT NOT NULL,
  price      REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item, store)
);
