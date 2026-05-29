-- run once on existing DBs to add the image column (safe if it already exists will error; ignore)
ALTER TABLE recipes ADD COLUMN image_url TEXT;
