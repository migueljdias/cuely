import { writeFileSync } from "node:fs";
import path from "node:path";
import { generateSeedSql } from "../src/repo/sql";

const out = path.resolve(import.meta.dirname, "../db/seed.sql");
writeFileSync(out, generateSeedSql());
console.log(`Wrote ${out}`);
