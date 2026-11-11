import { categories, recipes, tools, POLICY } from "@/catalog";
import { PLANS } from "@/plans";

export const dynamic = "force-static";

export function GET() {
  const body = [
    "# Cuely",
    "",
    "> Free MCP server that recommends tools and setup steps for what a user is building. No paid placement.",
    "",
    "MCP endpoint (Streamable HTTP): https://cuely.dev/api/mcp",
    "",
    "## Access",
    "- The MCP server needs a free Cuely account. OAuth sign-in (Clerk) is advertised at https://cuely.dev/.well-known/oauth-protected-resource/api/mcp; Claude's custom connectors use it.",
    "- Or send an API key from https://app.cuely.dev/account as: Authorization: Bearer cuely_...",
    `- Free: ${PLANS.free.perDay} tool calls a day, ${PLANS.free.perMinute} requests a minute. Pro ($10/month): ${PLANS.pro.perDay} tool calls a day, ${PLANS.pro.perMinute} requests a minute. Same answers on every plan.`,
    "- Over a limit: HTTP 429 with Retry-After and the reset time. Days reset at 00:00 UTC.",
    "",
    "## Tools",
    "- recommend_stack(description, answers?, assume_defaults?, detail?, categories?, already_using?, avoid?, needs?): leads with the top picks, the monthly cost at 1,000 users and the 2-3 catches that matter, then one pick per needed category. Covers web apps, phone apps, marketplaces, AI apps and staff tools. May return up to 3 questions (web or phone app, who pays whom, staff or customers); call again with answers. Says when a product is outside coverage. detail: \"full\" adds free plans, prices and alternatives.",
    "- get_recipe(product_type, include_steps?): full setup steps for a product type",
    "- compare_tools(a, b, context?): two tools in one category with a verdict",
    "- list_categories(category?): browse the catalog",
    "",
    "## Pages",
    "- Get started: https://cuely.dev/start",
    "- Recipes: https://cuely.dev/recipes",
    "- Tools by category: https://cuely.dev/tools",
    "- Comparisons: https://cuely.dev/compare/{a}-vs-{b} (tool slugs in alphabetical order, same category)",
    "",
    "## Recipes",
    ...recipes.map((r) => `- ${r.slug}: ${r.title} (https://cuely.dev/recipes/${r.slug})`),
    "",
    "## Categories",
    ...categories.map((c) => `- ${c.slug} (https://cuely.dev/categories/${c.slug}): ${tools.filter((t) => t.category === c.slug).map((t) => t.name).join(", ")}`),
    "",
    "## Policy",
    POLICY,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
