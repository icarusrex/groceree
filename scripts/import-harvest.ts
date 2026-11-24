// Bulk recipe import: raw schema.org Recipe records (one JSON object per line)
// → the same conversion and allergen gate as "add from link" → an SQL file for
// `wrangler d1 execute groceree --remote --file=<out>`.
//
// The recipes are other people's blog content, so neither the input nor the SQL
// belongs in this public repo: keep both outside it.
//
//   node scripts/import-harvest.ts <raw.jsonl> <out.sql>
import { readFileSync, writeFileSync } from "node:fs";
import { recipeFromLd } from "../src/engine/importRecipe.ts";
import { recipeRow, RECIPE_COLUMNS } from "../functions/api/_recipes.ts";

const [input, out] = process.argv.slice(2);
if (!input || !out) { console.error("usage: node scripts/import-harvest.ts <raw.jsonl> <out.sql>"); process.exit(1); }

const sql = (v: unknown) => v == null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const seen = new Set<string>();
const stmts: string[] = [];
const refused: Record<string, number> = {};
let ok = 0, unusable = 0, dupes = 0;

for (const line of readFileSync(input, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const raw = JSON.parse(line);
  const site = String(raw.source_site || new URL(raw.url).hostname).replace(/^www\./, "").toLowerCase();
  const rec = recipeFromLd({ ...raw, "@type": "Recipe" }, raw.url);
  if (!rec) { unusable++; continue; }
  const key = rec.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (seen.has(key)) { dupes++; continue; }
  seen.add(key);
  const slug = key.replace(/ /g, "-").slice(0, 60);
  const row = recipeRow({ ...rec, source: `import:${site}` }, `imp-${slug}`);
  if ("error" in row) {
    const a = row.error.match(/contains (\w+)/)?.[1] ?? "other";
    refused[a] = (refused[a] || 0) + 1;
    continue;
  }
  stmts.push(`INSERT OR IGNORE INTO recipes (${RECIPE_COLUMNS.join(",")}) VALUES (${row.values.map(sql).join(",")});`);
  ok++;
}

writeFileSync(out, stmts.join("\n") + "\n");
console.log(JSON.stringify({ imported: ok, refused_first_allergen: refused, unusable, duplicate_names: dupes }));
