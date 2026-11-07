import { describe, expect, it } from "vitest";
import { categories, recipes, tools } from "@/catalog";
import { compareTools } from "@/engine/compare";
import { detectNeeds } from "@/engine/needs";
import { matchRecipe, recommendStack, resolveTool } from "@/engine/recommend";

const snap = { categories, tools, recipes };
const pick = (r: ReturnType<typeof recommendStack>, cat: string) => r.stack.find((s) => s.category === cat)?.pick.slug;

describe("needs detection", () => {
  it("finds needs from plain words", () => {
    const needs = detectNeeds("A B2B SaaS for fintech startups in Europe, bootstrapped").map((d) => d.need);
    expect(needs).toEqual(expect.arrayContaining(["b2b", "regulated", "eu", "low_cost"]));
  });
  it("matches whole words only", () => {
    expect(detectNeeds("a reusable component").map((d) => d.need)).not.toContain("eu");
    expect(detectNeeds("the next big thing").map((d) => d.need)).not.toContain("nextjs");
  });
});

describe("recommend_stack", () => {
  it("agrees with the B2B SaaS recipe for a plain B2B SaaS description", () => {
    const r = recommendStack(snap, { description: "B2B SaaS with team workspaces, subscriptions and email invites" });
    expect(r.productType.recipe).toBe("b2b-saas");
    const recipe = recipes.find((x) => x.slug === "b2b-saas")!;
    for (const item of recipe.stack) expect(pick(r, item.category), item.category).toBe(item.tool);
  });

  it("adapts picks to a regulated fintech product", () => {
    const r = recommendStack(snap, { description: "SaaS for fintech companies with SOC 2 customers" });
    expect(pick(r, "auth")).toBe("workos-authkit");
    expect(pick(r, "payments")).toBe("stripe");
    expect(pick(r, "email")).toBe("postmark");
    expect(pick(r, "storage")).toBe("amazon-s3");
  });

  it("picks a merchant of record for worldwide digital sales", () => {
    const r = recommendStack(snap, { description: "sell digital products worldwide, handle VAT for me", categories: ["payments"] });
    expect(r.stack).toHaveLength(1);
    expect(pick(r, "payments")).toBe("paddle");
  });

  it("keeps tools the project already uses and says why", () => {
    const r = recommendStack(snap, { description: "B2B SaaS", alreadyUsing: ["Supabase", "Clerk"] });
    expect(pick(r, "database")).toBe("supabase");
    expect(pick(r, "auth")).toBe("clerk");
    expect(r.stack.find((s) => s.category === "auth")!.pick.reason).toMatch(/already use Clerk/);
  });

  it("leaves out avoided tools", () => {
    const r = recommendStack(snap, { description: "B2B SaaS", avoid: ["vercel"] });
    expect(pick(r, "hosting")).not.toBe("vercel");
  });

  it("is deterministic and identical for every caller", () => {
    const a = recommendStack(snap, { description: "realtime collaborative whiteboard, open source" });
    const b = recommendStack(snap, { description: "realtime collaborative whiteboard, open source" });
    expect(a).toEqual(b);
    expect(pick(a, "database")).toBe("supabase");
    expect(a.productType.recipe).toBeNull();
    expect(a.nextStep).toMatch(/No full recipe/);
  });

  it("flags non-commercial free plans", () => {
    const r = recommendStack(snap, { description: "Next.js B2B SaaS" });
    const hosting = r.stack.find((s) => s.category === "hosting")!;
    expect(hosting.pick.freeTierCommercialUse).toBe(false);
    expect(hosting.pick.watchOut).toMatch(/non-commercial/);
  });

  it("returns alternatives and the policy on every answer", () => {
    const r = recommendStack(snap, { description: "anything" });
    expect(r.stack).toHaveLength(10);
    for (const s of r.stack) expect(s.alternatives.length).toBeGreaterThanOrEqual(1);
    expect(r.policy).toMatch(/No vendor can pay/);
  });
});

describe("compare_tools and lookups", () => {
  it("resolves tools by name, slug and loose spelling", () => {
    expect(resolveTool(tools, "WorkOS")?.slug).toBe("workos-authkit");
    expect(resolveTool(tools, "lemon squeezy")?.slug).toBe("lemon-squeezy");
    expect(resolveTool(tools, "Route53")).toBeNull();
    expect(resolveTool(tools, "amazon route 53")?.slug).toBe("amazon-route-53");
  });

  it("compares two tools in one category with a verdict", () => {
    const c = compareTools(snap, { a: "Clerk", b: "WorkOS AuthKit", context: "B2B SaaS selling to enterprises needing SSO" });
    expect(c.ok).toBe(true);
    if (c.ok) {
      expect(c.verdict).toMatch(/WorkOS AuthKit fits better/);
      expect(c.differences.length).toBeGreaterThan(0);
    }
  });

  it("refuses cross-category and unknown comparisons", () => {
    expect(compareTools(snap, { a: "Stripe", b: "Neon" }).ok).toBe(false);
    expect(compareTools(snap, { a: "Stripe", b: "NotARealTool" }).ok).toBe(false);
  });

  it("routes product descriptions to recipes", () => {
    expect(matchRecipe(recipes, "multi-tenant CRM for agencies")?.slug).toBe("b2b-saas");
    expect(matchRecipe(recipes, "a recipe blog")).toBeNull();
  });
});
