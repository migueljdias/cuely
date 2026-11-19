import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CategorySlug, Need } from "@/catalog";
import { checkProject } from "@/engine/check";
import { compareTools } from "@/engine/compare";
import { startProject } from "@/engine/start";
import { ALL_NEEDS, NEED_LABELS } from "@/engine/needs";
import { detectCoverage } from "@/engine/profile";
import { matchRecipe, recommendStack } from "@/engine/recommend";
import type { Repository } from "@/repo";
import { renderCategories, renderCategory, renderCheck, renderCompare, renderRecipe, renderRecommendation, renderStart } from "./render";

/**
 * Shown by MCP clients next to the connector (Claude, VS Code, Cursor). Icons must be HTTPS and
 * on the server's own domain, so they point at cuely.dev, which also serves /api/mcp.
 */
export const SERVER_INFO = {
  name: "cuely",
  title: "Cuely",
  version: "0.5.0",
  websiteUrl: "https://cuely.dev",
  icons: [
    { src: "https://cuely.dev/brand/icon-512.png", mimeType: "image/png", sizes: ["512x512"] },
    { src: "https://cuely.dev/apple-icon.png", mimeType: "image/png", sizes: ["180x180"] },
    { src: "https://cuely.dev/icon.svg", mimeType: "image/svg+xml", sizes: ["any"] },
  ],
};

const CATEGORY_SLUGS = [
  "hosting", "database", "auth", "payments", "email", "secrets", "dns", "monitoring", "analytics", "storage",
  "llm", "vector", "realtime", "mobile_build", "internal_tools", "kv",
] as const satisfies readonly CategorySlug[];

export const INSTRUCTIONS = `Cuely recommends tools and setup steps for what a user is building: web apps, phone apps, marketplaces, AI apps, staff tools and casual web games.
When the user is starting a new project, call start_project once: it returns the stack and the security and compliance checklist for it, without questions. Otherwise use recommend_stack first with a one- or two-sentence description of the product (who it's for, what it does, any constraints such as budget, region, compliance, or tools already in use). The answer leads with the monthly cost at 1,000 users and the catches that matter.
If it returns questions, ask the user (or answer from the conversation) and call again with answers. If it says the product is outside Cuely's coverage, tell the user rather than forcing a stack.
If it names a recipe, call get_recipe for full setup steps.
Use check_project on a project that already exists: pass what it is and the tools it uses now (read the names from package.json, config files and env variable names, never their values), and it says what to keep, change or add with today's prices, outages and compliance facts. Run it again when the product changes.
Use compare_tools when the user is choosing between two specific tools, and list_categories to browse the catalog.
Send only what the tools ask for: the product in plain words and tool names. Never send source code, file contents, environment values, secrets, or the names of people, customers or companies; Cuely doesn't need them. Cuely doesn't store descriptions or tool lists (cuely.dev/trust).
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
          .describe("What the user is building, in plain words, e.g. 'B2B SaaS for fintech startups, EU customers, small budget'. Plain words only: no code, secrets, or names of people, customers or companies."),
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
        // Semgrep's MCP SSRF rule misfires here: this renders catalog text and makes no outbound request.
        content: [{ type: "text", text: renderRecommendation(rec, args.detail ?? "summary") }], // nosemgrep
        structuredContent: rec as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "start_project",
    {
      title: "Start a new project",
      description:
        "Everything a new build needs in one call: the stack for what the user is building (same picks, cost at 1,000 users and catches as recommend_stack), plus the security and compliance checklist for that product and stack, split into what to set up before real data goes in and what to finish before launch. Covers secrets, access control, payments, privacy, GDPR, HIPAA, business-customer reviews, AI and app-store rules, each with its source. Never asks questions: what the description leaves open is assumed and listed. Call it once at the start; use check_project later.",
      inputSchema: {
        description: z
          .string()
          .min(3)
          .max(2000)
          .describe("What the user is building, in plain words: who it's for, what it does, and constraints such as region, budget, health data or payments. Plain words only: no code, secrets, or names of people, customers or companies."),
        answers: z
          .object({
            platform: z.enum(["web", "mobile", "both"]).optional(),
            money: z.enum(["none", "users_pay_you", "users_pay_each_other"]).optional(),
            audience: z.enum(["customers", "internal"]).optional(),
          })
          .optional()
          .describe("Facts you know from the conversation: platform, who pays whom, customers or staff."),
        needs: z
          .array(z.enum(ALL_NEEDS as [Need, ...Need[]]))
          .optional()
          .describe("Explicit needs, added to those detected from the description. Same values as recommend_stack."),
        already_using: z.array(z.string()).optional().describe("Tools the user has already chosen (names or slugs)."),
        avoid: z.array(z.string()).optional().describe("Tools to leave out (names or slugs)."),
      },
      annotations: { title: "Start a new project", ...readOnly },
    },
    async (args) => {
      const snap = await ctx.repo.snapshot();
      const res = startProject(snap, {
        description: args.description,
        answers: args.answers,
        needs: args.needs,
        alreadyUsing: args.already_using,
        avoid: args.avoid,
      });
      log(ctx, "start_project", {
        recipe: res.recommendation.productType.recipe,
        categories: res.recommendation.stack.map((s) => s.category),
        needs: res.recommendation.detectedNeeds.map((d) => d.need),
      });
      return {
        // Semgrep's MCP SSRF rule misfires here: this renders catalog text and makes no outbound request.
        content: [{ type: "text", text: renderStart(res) }], // nosemgrep
        structuredContent: res as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "check_project",
    {
      title: "Check an existing project",
      description:
        "Review the stack of a project that is already being built. Pass what the product is and the tools it uses now; returns, per tool, keep or change (with the tool to move to and why), plus core parts that are missing and the catches for this kind of product. Uses the same rules as recommend_stack with today's prices, measured outages and each vendor's compliance statements (HIPAA BAA, GDPR DPA, EU region, SOC 2). A tool in use is kept unless another scores more than 4 points higher or its vendor says it doesn't offer what the product's data requires. Never asks questions: what the description leaves open is assumed and listed.",
      inputSchema: {
        description: z
          .string()
          .min(3)
          .max(2000)
          .describe("What the project is, in plain words, including anything that has changed (new region, payments, health data, AI), e.g. 'Next.js app where therapists keep patient notes, now adding EU customers'. Plain words only: no code, secrets, or names of people, customers or companies."),
        using: z
          .array(z.string().min(1).max(100))
          .min(1)
          .max(40)
          .describe("Tools the project uses now, names or slugs, e.g. ['Vercel', 'Supabase', 'Clerk', 'Stripe', 'Resend']. Read the names from package.json and config files and the variable names in env files; never send file contents or env values."),
        needs: z
          .array(z.enum(ALL_NEEDS as [Need, ...Need[]]))
          .optional()
          .describe("Explicit needs, added to those detected from the description. Same values as recommend_stack."),
        answers: z
          .object({
            platform: z.enum(["web", "mobile", "both"]).optional(),
            money: z.enum(["none", "users_pay_you", "users_pay_each_other"]).optional(),
            audience: z.enum(["customers", "internal"]).optional(),
          })
          .optional()
          .describe("Facts you know about the project: platform, who pays whom, customers or staff."),
      },
      annotations: { title: "Check an existing project", ...readOnly },
    },
    async (args) => {
      const snap = await ctx.repo.snapshot();
      const res = checkProject(snap, { description: args.description, using: args.using, needs: args.needs, answers: args.answers });
      log(ctx, "check_project", {
        categories: [...new Set(res.items.map((i) => i.category))],
        needs: res.detectedNeeds.map((d) => d.need),
      });
      return {
        // Semgrep's MCP SSRF rule misfires here: this renders catalog text and makes no outbound request.
        content: [{ type: "text", text: renderCheck(res) }], // nosemgrep
        structuredContent: res as unknown as Record<string, unknown>,
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
      // Semgrep's MCP SSRF rule misfires here: this renders catalog text and makes no outbound request.
      const coverage = bySlug ? null : detectCoverage(product_type); // nosemgrep
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
        // Semgrep's MCP SSRF rule misfires here: this renders catalog text and makes no outbound request.
        content: [{ type: "text", text: renderRecipe(recipe, snap.tools, include_steps !== false) }], // nosemgrep
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
        context: z.string().max(2000).optional().describe("What the user is building, to get a verdict for their case. Plain words only: no code, secrets, or names of people, customers or companies."),
      },
      annotations: { title: "Compare two tools", ...readOnly },
    },
    async ({ a, b, context }) => {
      const snap = await ctx.repo.snapshot();
      const res = compareTools(snap, { a, b, context });
      log(ctx, "compare_tools", { categories: res.ok ? [res.category] : [], needs: res.ok ? res.detectedNeeds : [] });
      return {
        // Semgrep's MCP SSRF rule misfires here: this renders catalog text and makes no outbound request.
        content: [{ type: "text", text: renderCompare(res) }], // nosemgrep
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
