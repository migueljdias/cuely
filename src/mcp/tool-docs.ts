/*
  Human-readable reference for the MCP server's tools, shown on the home page and on /start.
  Keep it in step with the tools registered in ./server.ts.
*/
export const MCP_TOOLS: { name: string; sig: string; what: string }[] = [
  {
    name: "recommend_stack",
    sig: "description, answers?, detail?, already_using?, avoid?",
    what: "The picks that matter, the monthly cost at 1,000 users and the catches that change the plan, then one line per category. Asks a short question first when the answer would change the pick, and says so when a product is outside its coverage.",
  },
  {
    name: "start_project",
    sig: "description, answers?, needs?, already_using?, avoid?",
    what: "One call at the start of a build: the stack, plus the security and compliance checklist for it (secrets, access control, payments, GDPR, HIPAA, AI, app stores), each item with its source.",
  },
  {
    name: "check_project",
    sig: "description, using, needs?, answers?",
    what: "For a project already under way: name the tools it uses and get keep, change or add for each part, with today's prices, outages and each vendor's compliance statements.",
  },
  {
    name: "get_recipe",
    sig: "product_type, include_steps?",
    what: "The full build: ordered steps, commands, starter files, best practices, pitfalls and compliance notes.",
  },
  {
    name: "compare_tools",
    sig: "a, b, context?",
    what: "Two options in one category, side by side, with a verdict for what you're building.",
  },
  {
    name: "list_categories",
    sig: "category?",
    what: "Browse the catalog: every tool's free plan, starting price and the page those facts came from.",
  },
];
