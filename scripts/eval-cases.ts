/**
 * Runs the five published evaluation prompts through recommend_stack and get_recipe
 * (in-memory catalog) and prints what an agent would receive. Usage: npx tsx scripts/eval-cases.ts
 */
import { categories, recipes, tools } from "@/catalog";
import { matchRecipe, recommendStack } from "@/engine/recommend";
import { renderRecipe, renderRecommendation } from "@/mcp/render";

export const CASES = [
  "I'm a solo founder building a team retrospective tool. Companies sign up, invite their team, run retros. Monthly per-seat subscription. I know Next.js. What stack should I use?",
  "I want to build an iOS and Android habit-coaching app with a $7.99/month subscription. I'm a web dev (React). What should I use?",
  "I'm building a local dog-walking marketplace. Owners book and pay walkers through the app, we keep 15%. Web first. Stack?",
  "I run a 10-person bakery. I want a simple app for staff to log daily inventory and wholesale orders. We use Google Workspace. Should I build it, and with what?",
  "I want to build a chatbot that answers questions over a company's PDFs (HR handbook, policies). Sell it to small companies with usage-based billing. What stack?",
];

const snap = { categories, tools, recipes };
const withRecipe = process.argv.includes("--recipes");
for (const description of CASES) {
  const r = recommendStack(snap, { description });
  console.log(`===== ${description}`);
  console.log(renderRecommendation(r));
  if (withRecipe) {
    const slug = r.productType.recipe;
    const recipe = slug ? recipes.find((x) => x.slug === slug) : matchRecipe(recipes, description);
    console.log(`\n----- get_recipe(${slug ?? "by description"}) -> ${recipe?.slug ?? "none"}`);
    if (recipe) console.log(renderRecipe(recipe, tools));
  }
}
