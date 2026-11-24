import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { accountStore } from "@/accounts/store";
import { checklistMarkdown, projectChecklist, readiness } from "@/accounts/checklist";
import { baselineFor, stackChanges, stackStore } from "@/accounts/stacks";
import { tools } from "@/catalog";
import type { Tool } from "@/catalog";

const schema = readFileSync(path.resolve(import.meta.dirname, "../db/schema.sql"), "utf8");
const tool = (slug: string) => tools.find((t) => t.slug === slug)!;

describe("Saved stack changes", () => {
  it("reports nothing when today's facts match the baseline", () => {
    const ts = [tool("vercel"), tool("clerk")];
    expect(stackChanges(baselineFor(ts), ts)).toEqual([]);
  });

  it("reports price, free plan, cost, health and compliance changes with a tone", () => {
    const before = tool("clerk");
    const after: Tool = {
      ...before,
      freeTier: "Up to 1 user",
      paidStartsAt: "$999/month",
      cost: { monthly: (before.cost?.monthly ?? 0) + 50, basis: "x" },
      health: { score: -2, reasons: ["Two outages this month."], measuredOn: "2026-11-24" },
      compliance: { readOn: "2026-11-24", facts: { baa: { answer: "no", detail: "", quote: "", source: "" } } },
    };
    const changes = stackChanges(baselineFor([before]), [after]);
    const kinds = changes.map((c) => c.kind);
    expect(kinds).toEqual(expect.arrayContaining(["free_tier", "price", "health", "compliance"]));
    expect(changes.find((c) => c.kind === "health")!.tone).toBe(before.health && before.health.score < -2 ? "better" : "worse");
    expect(changes.find((c) => c.kind === "health")!.text).toContain("Two outages");
  });

  it("ignores tools added after the baseline was taken", () => {
    expect(stackChanges({}, [tool("vercel")])).toEqual([]);
  });
});

describe("Stack store", () => {
  const db = new PGlite();
  const query = async (text: string, params?: unknown[]) => (await db.query(text, params)).rows as Record<string, any>[];
  const accounts = accountStore(query);
  const stacks = stackStore(query);

  beforeAll(async () => {
    await db.exec(schema);
    await accounts.ensure("user_a", "a@example.com");
    await accounts.ensure("user_b", "b@example.com");
  });

  it("saves, lists, updates and deletes a stack, scoped to its owner", async () => {
    const ts = [tool("vercel"), tool("clerk")];
    const id = await stacks.create("user_a", { name: "  Portal ", description: "B2B portal", tools: ["vercel", "clerk", "vercel"], baseline: baselineFor(ts) });
    const s = await stacks.get("user_a", id);
    expect(s).toMatchObject({ name: "Portal", description: "B2B portal", tools: ["vercel", "clerk"] });
    expect(Object.keys(s!.baseline).sort()).toEqual(["clerk", "vercel"]);
    expect(await stacks.get("user_b", id)).toBeNull();
    expect(await stacks.count("user_a")).toBe(1);

    // A new tool gets today's facts; tools that stay keep their old baseline.
    const stale = { ...s!.baseline.vercel, paidStartsAt: "old price" };
    await query("update saved_stacks set baseline = $1 where id = $2", [JSON.stringify({ ...s!.baseline, vercel: stale }), id]);
    await stacks.update("user_a", id, { name: "Portal", description: "", tools: ["vercel", "stripe"], fresh: baselineFor([tool("vercel"), tool("stripe")]) });
    const u = await stacks.get("user_a", id);
    expect(u!.tools).toEqual(["vercel", "stripe"]);
    expect(u!.baseline.vercel.paidStartsAt).toBe("old price");
    expect(u!.baseline.stripe).toBeDefined();
    expect(u!.baseline.clerk).toBeUndefined();

    expect(await stacks.update("user_b", id, { name: "x", description: "", tools: ["vercel"], fresh: {} })).toBe(false);
    await stacks.remove("user_b", id);
    expect(await stacks.count("user_a")).toBe(1);
    await stacks.remove("user_a", id);
    expect(await stacks.list("user_a")).toEqual([]);
  });

  it("ticks and unticks checklist items, scoped to the owner, storing only ids and dates", async () => {
    const id = await stacks.create("user_a", { name: "Notes", description: "", tools: ["vercel"], baseline: {} });
    expect((await stacks.get("user_a", id))!.checks).toEqual({});
    await stacks.setCheck("user_a", id, "secrets-out-of-git", true);
    await stacks.setCheck("user_b", id, "server-side-authz", true);
    await stacks.setCheck("user_a", id, "not a valid id; drop table", true);
    const ticked = (await stacks.get("user_a", id))!.checks;
    expect(Object.keys(ticked)).toEqual(["secrets-out-of-git"]);
    expect(ticked["secrets-out-of-git"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await stacks.setCheck("user_a", id, "secrets-out-of-git", false);
    expect((await stacks.get("user_a", id))!.checks).toEqual({});
    await stacks.remove("user_a", id);
  });
});

describe("Project checklist and readiness", () => {
  const ts = [tool("vercel"), tool("supabase"), tool("stripe")];
  const description = "A web app where therapists keep patient notes, with EU customers who pay a subscription";

  it("picks practices from the description and saved tools, and marks compliance items as blocking", () => {
    const items = projectChecklist({ description, checks: {} }, ts);
    expect(items.map((i) => i.id)).toContain("secrets-out-of-git");
    expect(items.every((i) => i.blocks === (i.area === "compliance"))).toBe(true);
    expect(items.some((i) => i.phase === "day_one")).toBe(true);
  });

  it("works out readiness from ticks", () => {
    const all = projectChecklist({ description, checks: {} }, ts);
    const blocking = all.filter((i) => i.blocks).map((i) => i.id);
    const checks = Object.fromEntries([...blocking, all[0].id].map((id) => [id, "2026-11-24"]));
    const r = readiness(projectChecklist({ description, checks }, ts));
    expect(r.total).toBe(all.length);
    expect(r.done).toBe(new Set([...blocking, all[0].id]).size);
    expect(r.blockersLeft).toBe(0);
    expect(r.pct).toBe(Math.round((r.done / r.total) * 100));
    expect(r.areas.reduce((s, a) => s + a.total, 0)).toBe(r.total);
    expect(readiness([])).toMatchObject({ pct: 0, total: 0, blockersLeft: 0 });
  });

  it("exports the checklist as Markdown with ticks", () => {
    const items = projectChecklist({ description, checks: { "secrets-out-of-git": "2026-11-24" } }, ts);
    const md = checklistMarkdown("Notes", items);
    expect(md).toContain("# Launch checklist: Notes");
    expect(md).toContain("- [x] **Keep keys and passwords out of the code**");
    expect(md).toContain("## Before real data goes in");
  });
});
