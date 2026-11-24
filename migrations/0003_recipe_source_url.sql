-- Imported recipes keep a link to the page they came from.
ALTER TABLE recipes ADD COLUMN source_url TEXT;
