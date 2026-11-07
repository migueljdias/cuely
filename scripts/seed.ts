/** Applies db/schema.sql and the generated seed to DATABASE_URL. Idempotent. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";
import { generateSeedSql } from "../src/repo/sql";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}
const pool = new Pool({ connectionString: url });
const schema = readFileSync(path.resolve(import.meta.dirname, "../db/schema.sql"), "utf8");
await pool.query(schema);
await pool.query(generateSeedSql());
const { rows } = await pool.query("select (select count(*) from categories) c, (select count(*) from tools) t, (select count(*) from recipes) r");
console.log(`Seeded: ${rows[0].c} categories, ${rows[0].t} tools, ${rows[0].r} recipes`);
await pool.end();
