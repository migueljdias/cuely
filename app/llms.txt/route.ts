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
    "- recommend_stack(description, categories?, already_using?, avoid?, needs?): one pick per category with reason, free-plan limits, alternatives",
    "- get_recipe(product_type, include_steps?): full setup steps for a product type",
    "- compare_tools(a, b, context?): two tools in one category with a verdict",
    "- list_categories(category?): browse the catalog",
    "",
    "## Recipes",
    ...recipes.map((r) => `- ${r.slug}: ${r.title}`),
    "",
    "## Categories",
    ...categories.map((c) => `- ${c.slug}: ${tools.filter((t) => t.category === c.slug).map((t) => t.name).join(", ")}`),
    "",
    "## Policy",
    POLICY,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
