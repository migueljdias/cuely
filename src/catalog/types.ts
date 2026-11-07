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
  | "storage";

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
  | "high_volume"; // large traffic or large send/storage volumes

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
  /** Date the facts were read from the vendor's own site (YYYY-MM-DD). */
  verifiedOn: string;
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
  verifiedOn: string;
}
