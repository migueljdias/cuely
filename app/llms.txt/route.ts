import { categories, recipes, tools, POLICY } from "@/catalog";

export const dynamic = "force-static";

export function GET() {
  const body = [
    "# Cuely",
    "",
    "> Free MCP server that recommends tools and setup steps for what a user is building. No account. No paid placement.",
    "",
    "MCP endpoint (Streamable HTTP): https://cuely.dev/api/mcp",
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
