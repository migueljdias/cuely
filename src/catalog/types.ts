/**
 * Catalog types. The TypeScript seed under src/catalog is the source of truth:
 * the SQL seed (db/seed.sql) is generated from it, and the in-memory repository
 * serves it directly when no database is configured.
 */

export type CategorySlug =
  | "hosting"
  | "database"
  | "auth"
  | "payments"
  | "email"
  | "secrets"
  | "dns"
  | "monitoring"
  | "analytics"
  | "storage"
  | "llm"
  | "vector"
  | "realtime"
  | "mobile_build"
  | "internal_tools"
  | "kv";

/**
 * Needs are what a builder's description can ask for. recommend_stack detects
 * them from plain words (see src/engine/needs.ts) and each tool says how well it
 * serves each one. That table is the whole ranking: no other input exists.
 */
export type Need =
  | "b2b" // organizations, roles, enterprise SSO for business customers
  | "regulated" // fintech, health, insurance: audits, SOC 2, data controls
  | "global_tax" // selling worldwide and wanting sales tax / VAT handled for you
  | "open_source" // prefers open source or self-hosting
  | "eu" // EU data residency or GDPR-sensitive users
  | "low_cost" // stay free or very cheap as long as possible
  | "edge" // global low latency, edge runtime
  | "nextjs" // Next.js app
  | "realtime" // live updates, presence, websockets
  | "fewer_vendors" // wants one platform to cover several categories
  | "per_tenant_db" // a separate database per customer
  | "long_running" // background workers, long jobs, persistent servers
  | "high_volume" // large traffic or large send/storage volumes
  | "mobile" // native iOS or Android app
  | "marketplace" // users pay each other through the product and the platform takes a cut
  | "rag" // answers over the user's own documents (retrieval)
  | "usage_billing" // charges by usage (metered)
  | "internal" // a tool for the builder's own staff, not for customers
  | "google_workspace" // the organization already runs on Google Workspace
  | "counters" // votes, scores, leaderboards, streaks: many small writes to the same numbers
  | "spiky"; // traffic arrives in bursts (a viral share, a launch), not evenly

export interface Category {
  slug: CategorySlug;
  name: string;
  /** What the category covers, in one sentence. */
  description: string;
  /** What to decide when choosing in this category. */
  howToChoose: string;
  order: number;
}

export interface NeedFit {
  /** -3 (poor fit) to +3 (best fit). */
  weight: number;
  /** One line shown to the agent when this need drives the pick. */
  reason: string;
}

export interface Tool {
  slug: string;
  name: string;
  category: CategorySlug;
  website: string;
  /** The page the free-tier and price facts were read from. */
  pricingUrl: string;
  /** One neutral sentence on what it is. */
  summary: string;
  /** Default one-line reason, used when no detected need drives the pick. */
  pitch: string;
  bestFor: string[];
  watchOut: string[];
  /** Exact free-plan limits as the vendor's page states them, or null if none. */
  freeTier: string | null;
  /** Cheapest paid option as the vendor's page states it, or null if not stated. */
  paidStartsAt: string | null;
  /** True or false only when the vendor states it; null when the page is silent. */
  freeTierCommercialUse: boolean | null;
  openSource: boolean;
  selfHostable: boolean;
  /**
   * Editorial default order within the category for the general case
   * (1 is the default pick). Published, and identical for every caller.
   */
  baseline: number;
  fit: Partial<Record<Need, NeedFit>>;
  /** What it costs at Cuely's published usage profile (see COST_PROFILE). */
  cost?: ToolCost;
  /** Date the facts were read from the vendor's own site (YYYY-MM-DD). */
  verifiedOn: string;
  /** Measured health (src/freshness/health.ts), or absent when nothing has been measured. */
  health?: ToolHealth;
}

/**
 * What the measured signals add to or take from a tool's score. Worked out by a
 * published formula from data/signals.json, which a scheduled job rewrites; no
 * person or model sets it.
 */
export interface ToolHealth {
  /** Added to the tool's score: -3 (failing) to +1 (growing fast, no problems). */
  score: number;
  /** One line per signal that moved the score, each with its number. */
  reasons: string[];
  /** Date the signals were measured (YYYY-MM-DD). */
  measuredOn: string;
}

/**
 * Monthly cost at the published usage profile (src/catalog/costs.ts), worked out
 * from the free-plan and price facts on the vendor's page. monthly is null when the
 * cost is a share of revenue (payments), which goes in variable instead.
 */
export interface ToolCost {
  monthly: number | null;
  /** The arithmetic, in one line, so an agent can redo it for other numbers. */
  basis: string;
  /** Fees that scale with revenue or payouts, e.g. "2.9% + 30¢ per card charge". */
  variable?: string;
  /** "1k_users" (default) or "10_staff" for internal-tool builders. */
  scale?: "1k_users" | "10_staff";
}

export interface RecipeStackItem {
  category: CategorySlug;
  tool: string;
  why: string;
  alternatives: { tool: string; when: string }[];
  optional?: boolean;
}

export interface RecipeStep {
  title: string;
  detail: string;
  /** Concrete actions, in order. */
  actions: string[];
  /** Shell commands, when a step has them. */
  commands?: string[];
  /** Files to create, path -> contents (short, illustrative skeletons). */
  files?: { path: string; contents: string }[];
  /** How to tell the step is done. */
  check: string;
  /** Vendor docs to read for the exact current API. */
  docs?: string[];
}

/** A fact that changes the plan for this product type, with the page it was read from. */
export interface RecipeCatch {
  text: string;
  source: string;
  /** Date the fact was read from the source (YYYY-MM-DD). */
  verifiedOn: string;
}

export interface Recipe {
  slug: string;
  title: string;
  summary: string;
  /** Plain words that route a description to this recipe. */
  matches: string[];
  fitsWhen: string[];
  notFor: string[];
  stack: RecipeStackItem[];
  steps: RecipeStep[];
  bestPractices: string[];
  pitfalls: string[];
  /** Points to obligations; never promises compliance. */
  complianceNotes: string[];
  /**
   * The facts that change the plan most, shown before the steps. Each names its
   * source page and the date it was read.
   */
  catches?: RecipeCatch[];
  /**
   * Costs outside the stack's monthly tool bills (store fees, tokens, payout fees),
   * each with its arithmetic. The tool bills themselves are summed from the catalog.
   */
  costNotes?: string[];
  /**
   * Where this product shape can't run on a tool's free plan (a daily game on Workers
   * Free), the monthly bill to use instead, with why. Used by get_recipe and recommend_stack.
   */
  costOverrides?: Record<string, { monthly: number; basis: string }>;
  verifiedOn: string;
}
