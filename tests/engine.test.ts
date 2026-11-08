import { describe, expect, it } from "vitest";
import { categories, recipes, tools } from "@/catalog";
import { compareTools } from "@/engine/compare";
import { detectNeeds } from "@/engine/needs";
import { detectCoverage, detectProfile } from "@/engine/profile";
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
    const r = recommendStack(snap, { description: "B2B SaaS for companies, per-seat subscriptions and email invites" });
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
    const r = recommendStack(snap, { description: "anything", assumeDefaults: true });
    expect(r.status).toBe("ok");
    expect(r.stack.length).toBeGreaterThanOrEqual(8);
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

const EVAL = {
  retro:
    "I'm a solo founder building a team retrospective tool. Companies sign up, invite their team, run retros. Monthly per-seat subscription. I know Next.js. What stack should I use?",
  habit:
    "I want to build an iOS and Android habit-coaching app with a $7.99/month subscription. I'm a web dev (React). What should I use?",
  dogs: "I'm building a local dog-walking marketplace. Owners book and pay walkers through the app, we keep 15%. Web first. Stack?",
  bakery:
    "I run a 10-person bakery. I want a simple app for staff to log daily inventory and wholesale orders. We use Google Workspace. Should I build it, and with what?",
  pdfs: "I want to build a chatbot that answers questions over a company's PDFs (HR handbook, policies). Sell it to small companies with usage-based billing. What stack?",
};
const catchIds = (r: ReturnType<typeof recommendStack>) => r.summary!.catches.map((c) => c.text).join(" ");

describe("the five eval cases", () => {
  it("B2B retro tool: realtime, org-aware auth, the SaaS recipe", () => {
    const r = recommendStack(snap, { description: EVAL.retro });
    expect(r.status).toBe("ok");
    expect(r.productType.recipe).toBe("b2b-saas");
    expect(pick(r, "realtime")).toBe("liveblocks");
    expect(pick(r, "auth")).toBe("workos-authkit");
    expect(r.summary!.cost!.text).toMatch(/^About \$\d+\/month at 1,000 users/);
  });

  it("habit app: phone builds, in-app purchase, no web hosting, Apple's rule first", () => {
    const r = recommendStack(snap, { description: EVAL.habit });
    expect(r.profile.platform).toBe("mobile");
    expect(pick(r, "mobile_build")).toBe("expo-eas");
    expect(pick(r, "payments")).toBe("revenuecat");
    expect(pick(r, "hosting")).toBeUndefined();
    expect(pick(r, "database")).toBe("supabase");
    expect(r.summary!.catches[0].text).toMatch(/in-app purchase/);
    expect(r.productType.recipe).toBe("mobile-subscription-app");
  });

  it("dog-walking marketplace: Stripe Connect, payouts and background checks", () => {
    const r = recommendStack(snap, { description: EVAL.dogs });
    expect(r.profile.money).toBe("users_pay_each_other");
    expect(r.profile.platform).toBe("web");
    expect(pick(r, "payments")).toBe("stripe-connect");
    expect(catchIds(r)).toMatch(/Stripe Connect/);
    expect(catchIds(r)).toMatch(/background checks/);
    expect(r.productType.recipe).toBe("marketplace");
  });

  it("bakery staff tool: a builder, AppSheet on Workspace, no payments", () => {
    const r = recommendStack(snap, { description: EVAL.bakery });
    expect(r.profile.audience).toBe("internal");
    expect(pick(r, "internal_tools")).toBe("appsheet");
    expect(pick(r, "payments")).toBeUndefined();
    expect(r.productType.recipe).toBe("internal-tool");
    expect(r.summary!.cost!.scale).toBe("10_staff");
    expect(catchIds(r)).toMatch(/AppSheet Core/);
  });

  it("PDF chatbot: model API, vector search, metered billing, token cost up front", () => {
    const r = recommendStack(snap, { description: EVAL.pdfs });
    expect(r.profile.ai).toBe(true);
    expect(pick(r, "llm")).toBeDefined();
    expect(pick(r, "vector")).toBe("pgvector");
    expect(pick(r, "payments")).toBe("stripe");
    expect(r.summary!.catches[0].text).toMatch(/Tokens/);
    expect(r.summary!.cost!.monthly).toBeGreaterThan(300);
  });

  it("all five resolve without questions", () => {
    for (const d of Object.values(EVAL)) expect(recommendStack(snap, { description: d }).status, d).toBe("ok");
  });
});

describe("questions, coverage and misroutes", () => {
  it("asks web or phone when an app's platform is unknown", () => {
    const r = recommendStack(snap, { description: "a habit tracking app with streaks and reminders" });
    expect(r.status).toBe("needs_answers");
    expect(r.questions.map((q) => q.id)).toContain("platform");
    expect(r.stack).toHaveLength(0);
  });

  it("asks who pays whom for a booking app", () => {
    const r = recommendStack(snap, { description: "a booking app for dog walkers and owners, web" });
    expect(r.questions.map((q) => q.id)).toContain("money");
  });

  it("uses answers and assumptions instead of asking again", () => {
    const d = "a habit tracking app with streaks and reminders";
    const a = recommendStack(snap, { description: d, answers: { platform: "mobile", money: "users_pay_you" } });
    expect(a.status).toBe("ok");
    expect(pick(a, "payments")).toBe("revenuecat");
    const b = recommendStack(snap, { description: d, assumeDefaults: true });
    expect(b.status).toBe("ok");
    expect(b.profile.assumed.length).toBeGreaterThan(0);
  });

  it("asks what it is when the description is too short", () => {
    expect(recommendStack(snap, { description: "my idea" }).questions[0].id).toBe("what");
  });

  it("says when a product is outside coverage", () => {
    const r = recommendStack(snap, { description: "a multiplayer game for phones" });
    expect(r.status).toBe("outside_coverage");
    expect(r.stack).toHaveLength(0);
    expect(detectCoverage("an online store for candles").status).toBe("partial");
  });

  it("doesn't read Google Workspace, teams or subscriptions as B2B SaaS", () => {
    expect(detectNeeds("We use Google Workspace").map((d) => d.need)).not.toContain("b2b");
    expect(matchRecipe(recipes, "a subscription app for my team")).toBeNull();
    expect(matchRecipe(recipes, "a workspace for designers")).toBeNull();
  });

  it("doesn't read React or 'web dev' as a web app when the product is a phone app", () => {
    const { profile } = detectProfile("an iOS and Android app. I'm a web dev (React).");
    expect(profile.platform).toBe("mobile");
    const r = recommendStack(snap, { description: "an iOS and Android app with a paid plan. I'm a web dev (React)." });
    expect(r.detectedNeeds.map((d) => d.need)).not.toContain("nextjs");
  });

  it("compare_tools names a better third option for the context", () => {
    const c = compareTools(snap, { a: "Stripe", b: "Paddle", context: EVAL.dogs });
    expect(c.ok && c.betterOption?.slug).toBe("stripe-connect");
  });
});

describe("recipes beyond B2B SaaS", () => {
  const AGREE: [string, string][] = [
    ["mobile-subscription-app", EVAL.habit],
    ["marketplace", EVAL.dogs],
    ["internal-tool", EVAL.bakery],
    ["ai-docs-app", EVAL.pdfs],
  ];

  for (const [slug, description] of AGREE) {
    it(`${slug}: recommend_stack routes to it and picks its stack`, () => {
      const r = recommendStack(snap, { description });
      expect(r.productType.recipe).toBe(slug);
      expect(r.nextStep).toMatch(new RegExp(`get_recipe with product_type "${slug}"`));
      const recipe = recipes.find((x) => x.slug === slug)!;
      for (const item of recipe.stack) expect(pick(r, item.category), `${slug}:${item.category}`).toBe(item.tool);
    });
  }

  it("routes by what the product is before matching words", () => {
    const route = (d: string) => recommendStack(snap, { description: d, assumeDefaults: true }).productType.recipe;
    expect(route("An iPhone and Android app for language flashcards with a $4.99 monthly subscription")).toBe("mobile-subscription-app");
    expect(route("A marketplace where tutors list lessons and students book and pay; we take a 10% commission. Web app.")).toBe("marketplace");
    expect(route("An internal tool for our 12 warehouse staff to log shipments")).toBe("internal-tool");
    expect(route("A web app where users chat with their own PDFs, paid monthly")).toBe("ai-docs-app");
    expect(route("B2B SaaS for agencies with per-seat billing")).toBe("b2b-saas");
  });

  it("a mobile marketplace gets the marketplace recipe with a note on the phone parts", () => {
    const r = recommendStack(snap, { description: "An iOS and Android app where owners book and pay dog walkers; we keep 15%", assumeDefaults: true });
    expect(r.productType.recipe).toBe("marketplace");
    expect(r.recipeNote).toMatch(/phone app/);
  });

  it("a B2B AI product without documents keeps the SaaS recipe and points to the AI one", () => {
    const r = recommendStack(snap, { description: "B2B SaaS for sales teams with an AI assistant that drafts follow-up emails, per-seat billing", assumeDefaults: true });
    expect(r.productType.recipe).toBe("b2b-saas");
    expect(r.recipeNote).toMatch(/ai-docs-app/);
  });

  it("a tool you already use still beats the recipe's pick", () => {
    const r = recommendStack(snap, { description: EVAL.habit, alreadyUsing: ["Firebase"] });
    expect(pick(r, "database")).toBe("firebase");
  });

  it("get_recipe finds each recipe by plain words", () => {
    expect(matchRecipe(recipes, "react native app with in-app purchases")?.slug).toBe("mobile-subscription-app");
    expect(matchRecipe(recipes, "two-sided marketplace with payouts")?.slug).toBe("marketplace");
    expect(matchRecipe(recipes, "chatbot over pdfs")?.slug).toBe("ai-docs-app");
    expect(matchRecipe(recipes, "internal tool for inventory")?.slug).toBe("internal-tool");
  });
});
