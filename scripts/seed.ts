/** Applies db/schema.sql and the generated seed to DATABASE_URL in one transaction. Idempotent. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { generateSeedStatements, splitSchema } from "../src/repo/sql";

const url = process.env.DATABASE_URL;
// `--production-only` is used by the Vercel build: sync the catalog into the
// production database on production deploys, and skip everywhere else.
if (process.argv.includes("--production-only") && process.env.VERCEL_ENV !== "production") {
  console.log("Catalog sync skipped (not a production deploy).");
  process.exit(0);
}
if (!url) {
  if (process.argv.includes("--production-only")) {
    console.log("Catalog sync skipped (no DATABASE_URL).");
    process.exit(0);
  }
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}
// Neon's HTTP driver: works from serverless functions and behind HTTPS proxies.
const sql = neon(url);
const schema = splitSchema(readFileSync(path.resolve(import.meta.dirname, "../db/schema.sql"), "utf8"));
await sql.transaction([...schema, ...generateSeedStatements()].map((s) => sql.query(s)));
const rows = (await sql.query(
  "select (select count(*) from categories) c, (select count(*) from tools) t, (select count(*) from recipes) r, (select count(*) from recipe_tools) rt",
)) as { c: string; t: string; r: string; rt: string }[];
console.log(`Seeded: ${rows[0].c} categories, ${rows[0].t} tools, ${rows[0].r} recipes, ${rows[0].rt} recipe tools`);
