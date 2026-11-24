import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { memoryRepository, postgresRepository } from "@/repo";
import { generateSeedSql, generateSeedStatements, splitSchema } from "@/repo/sql";

const schema = readFileSync(path.resolve(import.meta.dirname, "../db/schema.sql"), "utf8");

describe("Postgres schema and seed", () => {
  const db = new PGlite();
  const query = async (text: string, params?: unknown[]) => (await db.query(text, params)).rows as Record<string, any>[];

  beforeAll(async () => {
    await db.exec(schema);
    await db.exec(generateSeedSql());
  });

  it("loads every category, tool and recipe", async () => {
    const [c] = await query("select count(*)::int as n from categories");
    const [t] = await query("select count(*)::int as n from tools");
    const [r] = await query("select count(*)::int as n from recipe_tools where recipe_slug = 'b2b-saas'");
    expect(c.n).toBe(22);
    expect(t.n).toBeGreaterThanOrEqual(20);
    expect(r.n).toBe(10);
  });

  it("is idempotent: seeding twice changes nothing", async () => {
    await db.exec(generateSeedSql());
    const [t] = await query("select count(*)::int as n from tools");
    const mem = await memoryRepository().snapshot();
    expect(t.n).toBe(mem.tools.length);
  });

  it("also loads statement by statement, as the deploy-time sync does", async () => {
    const fresh = new PGlite();
    for (const s of [...splitSchema(schema), ...generateSeedStatements()]) await fresh.query(s);
    const [t] = (await fresh.query<{ n: number }>("select count(*)::int as n from tools")).rows;
    expect(t.n).toBe((await memoryRepository().snapshot()).tools.length);
    await fresh.close();
  });

  it("serves the same catalog from Postgres as from memory", async () => {
    const pg = await postgresRepository(query).snapshot();
    const mem = await memoryRepository().snapshot();
    const bySlug = <T extends { slug: string }>(xs: T[]) => [...xs].sort((a, b) => a.slug.localeCompare(b.slug));
    expect(bySlug(pg.categories)).toEqual(bySlug(mem.categories));
    expect(bySlug(pg.tools)).toEqual(bySlug(mem.tools));
    expect(pg.recipes).toEqual(mem.recipes);
  });

  it("logs usage without storing IPs or descriptions", async () => {
    const repo = postgresRepository(query);
    await repo.logUsage({ tool: "recommend_stack", recipe: "b2b-saas", categories: ["auth"], needs: ["b2b"], callerHash: "abc123" });
    const rows = await query("select * from usage_events");
    expect(rows).toHaveLength(1);
    expect(rows[0].tool).toBe("recommend_stack");
    expect(Object.keys(rows[0])).not.toContain("ip");
    expect(Object.keys(rows[0])).not.toContain("description");
  });
});
