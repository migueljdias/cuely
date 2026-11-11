import { describe, expect, it } from "vitest";
import { recipes, tools } from "@/catalog";
import { allPairs, pairSlug, parsePair, publicPaths, recipesUsing, toolBySlug } from "@/seo";

describe("catalog pages", () => {
  it("lists every public page once", () => {
    const paths = publicPaths().map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("/start");
    expect(paths.filter((p) => p.startsWith("/tools/")).length).toBe(tools.length);
  });

  it("has one canonical URL per same-category pair", () => {
    for (const p of allPairs()) {
      expect(p.a.category).toBe(p.b.category);
      expect(parsePair(p.slug)?.map((t) => t.slug)).toEqual([p.a.slug, p.b.slug]);
      // The reversed order is not a page, so no pair has two URLs.
      expect(parsePair(`${p.b.slug}-vs-${p.a.slug}`)).toBeNull();
    }
    expect(pairSlug("vercel", "netlify")).toBe("netlify-vs-vercel");
  });

  it("refuses pairs across categories or with unknown tools", () => {
    expect(parsePair("clerk-vs-vercel")).toBeNull();
    expect(parsePair("clerk-vs-nope")).toBeNull();
    expect(parsePair("clerk")).toBeNull();
  });

  it("links every recipe tool to a real tool page", () => {
    for (const r of recipes) {
      for (const s of r.stack) {
        expect(toolBySlug.has(s.tool), `${r.slug}: ${s.tool}`).toBe(true);
        for (const a of s.alternatives) expect(toolBySlug.has(a.tool), `${r.slug}: ${a.tool}`).toBe(true);
      }
    }
    expect(recipesUsing("stripe").some((u) => u.recipe.slug === "b2b-saas" && u.role === "pick")).toBe(true);
  });
});
