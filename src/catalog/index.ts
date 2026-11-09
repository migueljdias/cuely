import { categories } from "./categories";
import { tools as coreTools } from "./tools";
import { moreTools } from "./tools-more";
import { gameTools } from "./tools-games";
import { COSTS, COST_PROFILE } from "./costs";
import { b2bSaas } from "./recipes/b2b-saas";
import { mobileSubscriptionApp } from "./recipes/mobile-subscription-app";
import { marketplace } from "./recipes/marketplace";
import { aiDocsApp } from "./recipes/ai-docs-app";
import { internalTool } from "./recipes/internal-tool";
import { dailyWebGame } from "./recipes/daily-web-game";
import type { Recipe, Tool } from "./types";

export * from "./types";
export { COST_PROFILE };
export { CATCHES, type Catch } from "./catches";

/** Every tool, with its monthly cost at the published profile attached. */
export const tools: Tool[] = [...coreTools, ...moreTools, ...gameTools].map((t) => ({ ...t, cost: t.cost ?? COSTS[t.slug] }));
export { categories };

/** Sorted by slug, the same order the Postgres repository returns. */
export const recipes: Recipe[] = [b2bSaas, mobileSubscriptionApp, marketplace, aiDocsApp, internalTool, dailyWebGame].sort((a, b) => a.slug.localeCompare(b.slug));

/** One statement every answer carries, so agents can repeat it to users. */
export const POLICY =
  "Cuely's picks come from published rules in its open catalog. No vendor can pay for placement, and there are no affiliate links.";
