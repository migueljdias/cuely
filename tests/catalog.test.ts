import { describe, expect, it } from "vitest";
import { categories, recipes, tools } from "@/catalog";

describe("catalog integrity", () => {
  it("has the sixteen categories, each with 2 to 5 tools", () => {
    expect(categories.map((c) => c.slug).sort()).toEqual(
      ["analytics", "auth", "database", "dns", "email", "hosting", "internal_tools", "kv", "llm", "mobile_build", "monitoring",
        "payments", "realtime", "secrets", "storage", "vector"],
    );
    for (const c of categories) {
      const n = tools.filter((t) => t.category === c.slug).length;
      expect(n, c.slug).toBeGreaterThanOrEqual(2);
      expect(n, c.slug).toBeLessThanOrEqual(5);
    }
  });

  it("includes the livegoal.ai stack", () => {
    for (const slug of ["vercel", "supabase", "cloudflare-dns", "infisical", "resend"]) {
      expect(tools.some((t) => t.slug === slug), slug).toBe(true);
    }
  });

  it("has unique slugs and a unique editorial order inside each category", () => {
    expect(new Set(tools.map((t) => t.slug)).size).toBe(tools.length);
    for (const c of categories) {
      const b = tools.filter((t) => t.category === c.slug).map((t) => t.baseline).sort();
      expect(b, c.slug).toEqual(b.map((_, i) => i + 1));
    }
  });

  it("keeps every fit weight within -3..3 with a reason", () => {
    for (const t of tools) {
      for (const [need, f] of Object.entries(t.fit)) {
        expect(f!.weight, `${t.slug}.${need}`).toBeGreaterThanOrEqual(-3);
        expect(f!.weight, `${t.slug}.${need}`).toBeLessThanOrEqual(3);
        expect(f!.reason.length, `${t.slug}.${need}`).toBeGreaterThan(10);
      }
    }
  });

  it("dates every fact and links its source page over https", () => {
    for (const t of tools) {
      expect(t.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.pricingUrl).toMatch(/^https:\/\//);
      expect(t.website).toMatch(/^https:\/\//);
    }
  });

  it("carries no affiliate, referral or tracking parameters (money never touches answers)", () => {
    const urls = [...tools.flatMap((t) => [t.website, t.pricingUrl]), ...recipes.flatMap((r) => [...r.steps.flatMap((s) => s.docs ?? []), ...(r.catches ?? []).map((c) => c.source)])];
    for (const u of urls) {
      expect(new URL(u).search, u).toBe("");
    }
    for (const t of tools) {
      expect(Object.keys(t)).not.toContain("sponsored");
      expect(Object.keys(t)).not.toContain("affiliate");
    }
  });

  it("has recipes whose stack tools exist in the right categories", () => {
    for (const r of recipes) {
      for (const s of r.stack) {
        const tool = tools.find((t) => t.slug === s.tool);
        expect(tool, `${r.slug}:${s.tool}`).toBeDefined();
        expect(tool!.category).toBe(s.category);
        for (const a of s.alternatives) {
          const alt = tools.find((t) => t.slug === a.tool);
          expect(alt, `${r.slug}:${a.tool}`).toBeDefined();
          expect(alt!.category).toBe(s.category);
        }
      }
      expect(r.steps.length).toBeGreaterThanOrEqual(5);
      for (const s of r.steps) expect(s.check.length).toBeGreaterThan(10);
      // Every recipe leads with dated, sourced catches and says what it costs.
      expect(r.catches?.length, r.slug).toBeGreaterThanOrEqual(3);
      for (const c of r.catches ?? []) {
        expect(c.source, r.slug).toMatch(/^https:\/\//);
        expect(c.verifiedOn, r.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      expect(r.costNotes?.length, r.slug).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives every tool a monthly cost at the published profile", () => {
    for (const t of tools) {
      expect(t.cost, t.slug).toBeDefined();
      expect(t.cost!.basis.length, t.slug).toBeGreaterThan(5);
    }
  });
});
