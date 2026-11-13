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
import { consumerWebApp } from "./recipes/consumer-web-app";
import type { Recipe, Tool } from "./types";
import { healthFrom, normsOf, outageRivals, type SignalsFile } from "@/freshness/health";
import { applyFacts, type FactsFile } from "@/freshness/facts";
import type { ComplianceFile } from "@/freshness/compliance";
import signalsJson from "../../data/signals.json";
import complianceJson from "../../data/compliance.json";
import factsJson from "../../data/facts.json";

export * from "./types";
export { COST_PROFILE };
export { CATCHES, type Catch } from "./catches";

/**
 * Measured signals, rewritten by the scheduled job (scripts/collect-signals.ts).
 * CUELY_NO_SIGNALS=1 leaves them out, so tests of the rules don't move with the week's data.
 */
export const signals: SignalsFile = process.env.CUELY_NO_SIGNALS === "1" ? { measuredOn: null, tools: {} } : (signalsJson as SignalsFile);

/**
 * Price and limit facts the weekly job re-read from vendor pages (scripts/update-facts.ts).
 * CUELY_NO_FACT_UPDATES=1 leaves them out, so tests check the hand-written catalog.
 */
export const factUpdates: FactsFile = process.env.CUELY_NO_FACT_UPDATES === "1" ? { tools: {} } : (factsJson as FactsFile);

/**
 * What each vendor's pages say about BAAs, DPAs, EU regions and SOC 2, re-read by the
 * weekly job (scripts/collect-compliance.ts). CUELY_NO_COMPLIANCE=1 leaves them out for tests.
 */
export const compliance: ComplianceFile = process.env.CUELY_NO_COMPLIANCE === "1" ? { tools: {} } : (complianceJson as ComplianceFile);

/** Every tool, with its monthly cost at the published profile and its measured health attached. */
const allTools = [...coreTools, ...moreTools, ...gameTools];
const norms = normsOf(signals);
const rivals = outageRivals(allTools, signals);
export const tools: Tool[] = allTools.map((t) => {
  const health = healthFrom(signals.tools[t.slug], signals.measuredOn, norms, rivals.has(t.slug));
  const withCost = applyFacts({ ...t, cost: t.cost ?? COSTS[t.slug] }, factUpdates.tools[t.slug]);
  const read = compliance.tools[t.slug];
  return { ...withCost, ...(health ? { health } : {}), ...(read ? { compliance: read } : {}) };
});
export { categories };

/** Sorted by slug, the same order the Postgres repository returns. */
export const recipes: Recipe[] = [b2bSaas, mobileSubscriptionApp, marketplace, aiDocsApp, internalTool, dailyWebGame, consumerWebApp].sort((a, b) => a.slug.localeCompare(b.slug));

/** One statement every answer carries, so agents can repeat it to users. */
export const POLICY =
  "Cuely's picks come from published rules in its open catalog. No vendor can pay for placement, and there are no affiliate links.";
