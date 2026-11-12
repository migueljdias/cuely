import { describe, expect, it } from "vitest";
import { categories, recipes, tools } from "@/catalog";
import { SOURCES } from "@/catalog/sources";
import { recommendStack, scoreTool } from "@/engine/recommend";
import { countAdvisories, countIncidents, downloadWindows, healthFrom, normsOf, NO_NORMS, type ToolSignals } from "@/freshness/health";

const NOW = new Date("2026-11-12T00:00:00Z");
const none: ToolSignals = { incidents: null, advisories: null, downloads: null };
const status = "https://status.example.com";

describe("health from signals", () => {
  it("is absent when nothing was measured", () => {
    expect(healthFrom(undefined, "2026-11-12")).toBeUndefined();
    expect(healthFrom(none, "2026-11-12")).toBeUndefined();
    expect(healthFrom({ ...none, incidents: { minor: 1, major: 0, critical: 0, source: status } }, null)).toBeUndefined();
  });

  it("is zero with no reasons for a quiet tool, and ignores minor incidents and small download changes", () => {
    const h = healthFrom({
      incidents: { minor: 12, major: 0, critical: 0, source: status },
      advisories: { high: 0, critical: 0, package: "x" },
      downloads: { recent: 105_000, earlier: 100_000, package: "x" },
    }, "2026-11-12");
    expect(h).toEqual({ score: 0, reasons: [], measuredOn: "2026-11-12" });
  });

  it("takes 0.25 per major and 0.75 per critical incident, capped at 1.2", () => {
    const h = (major: number, critical: number) => healthFrom({ ...none, incidents: { minor: 0, major, critical, source: status } }, "2026-11-12")!;
    expect(h(2, 0).score).toBe(-0.5);
    expect(h(1, 1).score).toBe(-1);
    expect(h(1, 1).reasons[0]).toBe(`1 critical incident and 1 major incident on its status page in the last 90 days (${status}).`);
    expect(h(20, 20).score).toBe(-1.2);
  });

  it("takes points for recent high and critical advisories, capped at 1", () => {
    const h = (high: number, critical: number) => healthFrom({ ...none, advisories: { high, critical, package: "pkg" } }, "2026-11-12")!;
    expect(h(1, 0).score).toBe(-0.2); // -0.25 rounds toward zero at one decimal
    expect(h(0, 1).score).toBe(-0.5);
    expect(h(2, 0).reasons[0]).toBe("2 high-severity security advisories for pkg in the last 180 days.");
    expect(h(9, 9).score).toBe(-1);
  });

  it("follows adoption both ways, ignores small packages, and never goes past -2.7 or +0.5", () => {
    const h = (recent: number, earlier: number, extra: Partial<ToolSignals> = {}) =>
      healthFrom({ ...none, ...extra, downloads: { recent, earlier, package: "pkg" } }, "2026-11-12")!;
    expect(h(130_000, 100_000)).toMatchObject({ score: 0.3, reasons: ["Downloads of pkg rose 30% over three months."] });
    expect(h(60_000, 100_000)).toMatchObject({ score: -0.4, reasons: ["Downloads of pkg fell 40% over three months."] });
    expect(h(900_000, 100_000).score).toBe(0.5);
    expect(h(5_000, 500).score).toBe(0);
    const worst = h(0, 100_000, { incidents: { minor: 0, major: 0, critical: 9, source: status }, advisories: { high: 0, critical: 9, package: "pkg" } });
    expect(worst.score).toBe(-2.7);
    expect(worst.reasons[0]).toMatch(/critical incidents/);
  });
});

describe("health against the typical tool", () => {
  const page = (n: number, major: number, critical = 0): ToolSignals => ({ ...none, incidents: { minor: 0, major, critical, source: `https://status${n}.example.com` } });
  const pkg = (n: number, recent: number, earlier = 100_000): ToolSignals => ({ ...none, downloads: { recent, earlier, package: `pkg${n}` } });

  it("takes the median across status pages and packages, counting a shared one once", () => {
    const tools: Record<string, ToolSignals> = {
      a: page(1, 0), b: page(2, 2), c: page(3, 4), d: page(4, 8), e: page(5, 0, 4),
      f: page(5, 0, 4), // same page as e
      g: pkg(1, 110_000), h: pkg(2, 140_000), i: pkg(3, 150_000), j: pkg(4, 160_000), k: pkg(5, 300_000),
      l: pkg(6, 9_000, 500), // too small to count
    };
    expect(normsOf({ measuredOn: "2026-11-12", tools })).toEqual({ incidentPoints: 1, growth: 1.5 });
  });

  it("judges each tool on its own until five are measured", () => {
    expect(normsOf({ measuredOn: "2026-11-12", tools: { a: page(1, 4), b: pkg(1, 200_000) } })).toEqual(NO_NORMS);
    expect(normsOf({ measuredOn: null, tools: {} })).toEqual(NO_NORMS);
  });

  it("only counts incidents beyond the typical vendor's", () => {
    const norms = { incidentPoints: 1, growth: 1 };
    expect(healthFrom(page(1, 4), "2026-11-12", norms)).toEqual({ score: 0, reasons: [], measuredOn: "2026-11-12" });
    expect(healthFrom(page(1, 6), "2026-11-12", norms)).toMatchObject({
      score: -0.5,
      reasons: ["6 major incidents on its status page in the last 90 days, more than the typical vendor Cuely tracks (https://status1.example.com)."],
    });
  });

  it("measures adoption against the market, so a rising market lifts nobody", () => {
    const norms = { incidentPoints: 0, growth: 1.5 };
    expect(healthFrom(pkg(1, 150_000), "2026-11-12", norms)!.score).toBe(0);
    expect(healthFrom(pkg(1, 195_000), "2026-11-12", norms)).toMatchObject({
      score: 0.3,
      reasons: ["Downloads of pkg1 rose 95% over three months; the typical package Cuely tracks rose 50%."],
    });
    expect(healthFrom(pkg(1, 105_000), "2026-11-12", norms)).toMatchObject({
      score: -0.3,
      reasons: ["Downloads of pkg1 rose 5% over three months; the typical package Cuely tracks rose 50%."],
    });
  });
});

describe("reading the sources", () => {
  it("counts status-page incidents from the last 90 days by impact", () => {
    const body = { incidents: [
      { impact: "critical", created_at: "2026-11-01T10:00:00Z" },
      { impact: "major", created_at: "2026-09-01T10:00:00Z" },
      { impact: "minor", created_at: "2026-10-20T10:00:00Z" },
      { impact: "none", created_at: "2026-10-21T10:00:00Z" },
      { impact: "major", created_at: "2026-07-01T10:00:00Z" }, // older than 90 days
      { impact: "major", created_at: "not a date" },
    ] };
    expect(countIncidents(body, NOW)).toEqual({ minor: 1, major: 1, critical: 1 });
    expect(countIncidents({ incidents: [] }, NOW)).toEqual({ minor: 0, major: 0, critical: 0 });
    expect(countIncidents({ page: {} }, NOW)).toBeNull();
    expect(countIncidents(null, NOW)).toBeNull();
  });

  it("counts recent high and critical advisories and skips withdrawn and old ones", () => {
    const body = { vulns: [
      { published: "2026-10-01T00:00:00Z", database_specific: { severity: "HIGH" } },
      { published: "2026-09-01T00:00:00Z", database_specific: { severity: "CRITICAL" } },
      { published: "2026-09-02T00:00:00Z", database_specific: { severity: "MODERATE" } },
      { published: "2026-09-03T00:00:00Z", withdrawn: "2026-09-04T00:00:00Z", database_specific: { severity: "CRITICAL" } },
      { published: "2025-01-01T00:00:00Z", database_specific: { severity: "CRITICAL" } },
    ] };
    expect(countAdvisories(body, NOW)).toEqual({ high: 1, critical: 1 });
    expect(countAdvisories({}, NOW)).toEqual({ high: 0, critical: 0 }); // OSV returns {} for a package with none
    expect(countAdvisories(null, NOW)).toBeNull();
    expect(countAdvisories([], NOW)).toBeNull();
  });

  it("compares two 28-day download windows three months apart", () => {
    expect(downloadWindows(NOW)).toEqual({ recent: ["2026-10-14", "2026-11-10"], earlier: ["2026-07-15", "2026-08-11"] });
  });

  it("only names tools that exist, with https status pages and no trailing slash", () => {
    const slugs = new Set(tools.map((t) => t.slug));
    for (const [slug, src] of Object.entries(SOURCES)) {
      expect(slugs.has(slug), slug).toBe(true);
      if (src.status) expect(src.status, slug).toMatch(/^https:\/\/[a-z0-9.-]+$/);
      expect(src.status || src.npm, slug).toBeTruthy();
    }
  });
});

describe("health in the ranking", () => {
  const description = "A web app for customers with a monthly subscription";
  const withHealth = (slug: string, score: number, reason: string) =>
    tools.map((t) => (t.slug === slug ? { ...t, health: { score, reasons: [reason], measuredOn: "2026-11-12" } } : t));

  it("adds health to the score", () => {
    const vercel = tools.find((t) => t.slug === "vercel")!;
    const base = scoreTool(vercel, [], 4, false);
    expect(scoreTool({ ...vercel, health: { score: -1.5, reasons: ["x"], measuredOn: "2026-11-12" } }, [], 4, false)).toBeCloseTo(base - 1.5);
  });

  it("keeps the default pick while it is healthy", () => {
    const r = recommendStack({ categories, tools, recipes }, { description });
    const hosting = r.stack.find((s) => s.category === "hosting")!;
    expect(hosting.pick.slug).toBe("vercel");
    expect(hosting.pick.health).toBeNull();
  });

  it("hands the pick to the next tool when the default one fails, and says why", () => {
    const reason = "2 critical incidents on its status page in the last 90 days (https://www.vercel-status.com).";
    const r = recommendStack({ categories, tools: withHealth("vercel", -1.5, reason), recipes }, { description });
    const hosting = r.stack.find((s) => s.category === "hosting")!;
    expect(hosting.pick.slug).not.toBe("vercel");
    expect(hosting.pick.reason).toContain(`Picked over Vercel, which measured worse on 2026-11-12: ${reason}`);
  });

  it("still picks a tool whose fit outweighs a small health loss, and puts the loss in the catches", () => {
    const reason = "2 major incidents on its status page in the last 90 days (https://www.vercel-status.com).";
    const r = recommendStack({ categories, tools: withHealth("vercel", -0.5, reason), recipes }, { description: `${description}, built with Next.js` });
    const hosting = r.stack.find((s) => s.category === "hosting")!;
    expect(hosting.pick.slug).toBe("vercel");
    expect(hosting.pick.health).toEqual({ score: -0.5, reasons: [reason], measuredOn: "2026-11-12" });
    expect([...r.summary!.catches, ...r.summary!.moreCatches].map((c) => c.text)).toContain(`Vercel: ${reason}`);
  });
});
