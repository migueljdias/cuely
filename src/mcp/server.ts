import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CategorySlug, Need } from "@/catalog";
import { compareTools } from "@/engine/compare";
import { ALL_NEEDS, NEED_LABELS } from "@/engine/needs";
import { detectCoverage } from "@/engine/profile";
import { matchRecipe, recommendStack } from "@/engine/recommend";
import type { Repository } from "@/repo";
import { renderCategories, renderCategory, renderCompare, renderRecipe, renderRecommendation } from "./render";

export const SERVER_INFO = { name: "cuely", version: "0.2.0" };

const CATEGORY_SLUGS = [
  "hosting", "database", "auth", "payments", "email", "secrets", "dns", "monitoring", "analytics", "storage",
  "llm", "vector", "realtime", "mobile_build", "internal_tools", "kv",
] as const satisfies readonly CategorySlug[];

export const INSTRUCTIONS = `Cuely recommends tools and setup steps for what a user is building: web apps, phone apps, marketplaces, AI apps, staff tools and casual web games.
Use recommend_stack first with a one- or two-sentence description of the product (who it's for, what it does, any constraints such as budget, region, compliance, or tools already in use). The answer leads with the monthly cost at 1,000 users and the catches that matter.
If it returns questions, ask the user (or answer from the conversation) and call again with answers. If it says the product is outside Cuely's coverage, tell the user rather than forcing a stack.
If it names a recipe, call get_recipe for full setup steps.
Use compare_tools when the user is choosing between two specific tools, and list_categories to browse the catalog.
Picks come from published rules; no vendor pays for placement. Prices and limits were read from each vendor's own site on the date shown; confirm on the linked page before committing money.`;

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export interface ServerContext {
  repo: Repository;
  callerHash?: string | null;
}

function log(ctx: ServerContext, tool: string, extra: { recipe?: string | null; categories?: string[]; needs?: Need[] } = {}) {
  // Usage logging must never break a tool call.
  ctx.repo.logUsage({ tool, callerHash: ctx.callerHash ?? null, ...extra }).catch(() => {});
}

export function createCuelyServer(ctx: ServerContext): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });

  server.registerTool(
    "recommend_stack",
    {
      title: "Recommend a stack",
      description:
        "Recommend a stack for what the user is building. Leads with the top picks, the monthly cost at 1,000 users and the 2-3 catches that matter (e.g. Apple's in-app purchase rule, marketplace payouts, AI token costs), then one line per category. Picks only the categories the product needs, from: hosting, database, auth, payments, email, secrets, DNS, monitoring, analytics, storage, AI model APIs, vector search, realtime, mobile builds, internal-tool builders, and counters and cache. If the description leaves out something that changes the picks (web or phone app, who pays whom, staff or customers), it returns up to 3 short questions instead; call again with answers. Says so when a product is outside Cuely's coverage.",
      inputSchema: {
        description: z
          .string()
          .min(3)
          .max(2000)
          .describe("What the user is building, in plain words, e.g. 'B2B SaaS for fintech startups, EU customers, small budget'."),
        categories: z.array(z.enum(CATEGORY_SLUGS)).optional().describe("Only these categories. Omit for all."),
        already_using: z.array(z.string()).optional().describe("Tools the project already uses (names or slugs)."),
        avoid: z.array(z.string()).optional().describe("Tools to leave out (names or slugs)."),
        needs: z
          .array(z.enum(ALL_NEEDS as [Need, ...Need[]]))
          .optional()
          .describe(`Explicit needs, added to those detected from the description: ${ALL_NEEDS.map((n) => `${n} (${NEED_LABELS[n]})`).join(", ")}.`),
        answers: z
          .object({
            platform: z.enum(["web", "mobile", "both"]).optional().describe("Website or web app, phone app, or both."),
            money: z
              .enum(["none", "users_pay_you", "users_pay_each_other"])
              .optional()
              .describe("No payments, users pay you, or users pay each other and you take a cut."),
            audience: z.enum(["customers", "internal"]).optional().describe("For customers, or for your own staff."),
          })
          .optional()
          .describe("Answers to questions from an earlier call, or facts you already know from the conversation."),
        assume_defaults: z
          .boolean()
          .optional()
          .describe("Skip questions and assume the most common case; the answer lists what it assumed."),
        detail: z
          .enum(["summary", "full"])
          .optional()
          .describe("'summary' (default) is short; 'full' adds each pick's free plan, prices, cost basis and alternatives."),
      },
      annotations: { title: "Recommend a stack", ...readOnly },
    },
    async (args) => {
      const snap = await ctx.repo.snapshot();
      const rec = recommendStack(snap, {
        description: args.description,
        categories: args.categories,
        alreadyUsing: args.already_using,
        avoid: args.avoid,
        needs: args.needs,
        answers: args.answers,
        assumeDefaults: args.assume_defaults,
        detail: args.detail,
      });
      log(ctx, "recommend_stack", {
        recipe: rec.productType.recipe,
        categories: rec.stack.map((s) => s.category),
        needs: rec.detectedNeeds.map((d) => d.need),
      });
      return {
        content: [{ type: "text", text: renderRecommendation(rec, args.detail ?? "summary") }],
        structuredContent: rec as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Get a recipe",
      description:
        "Full setup steps for a product type: the stack with alternatives, ordered steps with commands and starter files, best practices, pitfalls and compliance notes.",
      inputSchema: {
        product_type: z
          .string()
          .min(2)
          .max(500)
          .describe("A recipe slug (e.g. 'b2b-saas') or a short description of the product type."),
        include_steps: z.boolean().optional().describe("Set false for just the stack and practices. Default true."),
      },
      annotations: { title: "Get a recipe", ...readOnly },
    },
    async ({ product_type, include_steps }) => {
      const snap = await ctx.repo.snapshot();
      const bySlug = snap.recipes.find((r) => r.slug === product_type.trim().toLowerCase());
      // A description of something Cuely doesn't cover (a phone or engine game) gets no recipe,
      // even when a word like "game" matches one.
      const coverage = bySlug ? null : detectCoverage(product_type);
      const outside = coverage?.status === "outside" ? coverage.notes.join(" ") + " " : "";
      const recipe = bySlug ?? (outside ? null : matchRecipe(snap.recipes, product_type));
      log(ctx, "get_recipe", { recipe: recipe?.slug ?? null });
      if (!recipe) {
        const available = snap.recipes.map((r) => ({ slug: r.slug, title: r.title }));
        return {
          content: [
            {
              type: "text",
              text: `${outside}No recipe matches "${product_type}" yet. Available: ${available.map((a) => `${a.slug} (${a.title})`).join(", ")}. recommend_stack still works for any product type.`,
            },
          ],
          structuredContent: { found: false, available },
        };
      }
      return {
        content: [{ type: "text", text: renderRecipe(recipe, snap.tools, include_steps !== false) }],
        structuredContent: { found: true, recipe: recipe as unknown as Record<string, unknown> },
      };
    },
  );

  server.registerTool(
    "compare_tools",
    {
      title: "Compare two tools",
      description:
        "Compare two tools in the same category side by side: free plans, prices, strengths, and a verdict for the given context.",
      inputSchema: {
        a: z.string().min(1).describe("First tool, name or slug (e.g. 'Clerk')."),
        b: z.string().min(1).describe("Second tool, name or slug (e.g. 'WorkOS AuthKit')."),
        context: z.string().max(2000).optional().describe("What the user is building, to get a verdict for their case."),
      },
      annotations: { title: "Compare two tools", ...readOnly },
    },
    async ({ a, b, context }) => {
      const snap = await ctx.repo.snapshot();
      const res = compareTools(snap, { a, b, context });
      log(ctx, "compare_tools", { categories: res.ok ? [res.category] : [], needs: res.ok ? res.detectedNeeds : [] });
      return {
        content: [{ type: "text", text: renderCompare(res) }],
        structuredContent: res as unknown as Record<string, unknown>,
        isError: !res.ok,
      };
    },
  );

  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description:
        "List the catalog's categories and their tools. Pass a category to get each tool's free plan, price, strengths and source page.",
      inputSchema: {
        category: z.enum(CATEGORY_SLUGS).optional().describe("One category to expand."),
      },
      annotations: { title: "List categories", ...readOnly },
    },
    async ({ category }) => {
      const snap = await ctx.repo.snapshot();
      log(ctx, "list_categories", { categories: category ? [category] : [] });
      if (category) {
        const c = snap.categories.find((x) => x.slug === category)!;
        const inCat = snap.tools.filter((t) => t.category === category);
        return {
          content: [{ type: "text", text: renderCategory(c, snap.tools) }],
          structuredContent: { category: c, tools: inCat } as unknown as Record<string, unknown>,
        };
      }
      return {
        content: [{ type: "text", text: renderCategories(snap.categories, snap.tools) }],
        structuredContent: {
          categories: snap.categories.map((c) => ({
            ...c,
            tools: snap.tools.filter((t) => t.category === c.slug).map((t) => t.slug),
          })),
          recipes: snap.recipes.map((r) => ({ slug: r.slug, title: r.title })),
        },
      };
    },
  );

  return server;
}
