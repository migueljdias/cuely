import { categories, recipes, tools, type Category, type Need, type Recipe, type Tool } from "@/catalog";
import type { CatalogSnapshot } from "@/engine/recommend";

export interface UsageEvent {
  tool: string;
  recipe?: string | null;
  categories?: string[];
  needs?: Need[];
  callerHash?: string | null;
}

export interface Repository {
  kind: "memory" | "postgres";
  snapshot(): Promise<CatalogSnapshot>;
  logUsage(e: UsageEvent): Promise<void>;
}

/** Serves the bundled seed directly. Used in development and when no DATABASE_URL is set. */
export function memoryRepository(): Repository & { events: UsageEvent[] } {
  const events: UsageEvent[] = [];
  const snap: CatalogSnapshot = { categories, tools, recipes };
  return {
    kind: "memory",
    events,
    async snapshot() {
      return snap;
    },
    async logUsage(e) {
      events.push(e);
      if (events.length > 1000) events.shift();
    },
  };
}

export type QueryFn = (text: string, params?: unknown[]) => Promise<Record<string, any>[]>;

/**
 * Reads the catalog from Postgres. The snapshot is cached in memory for
 * cacheMs, so a busy function instance makes one catalog read per minute.
 */
export function postgresRepository(query: QueryFn, cacheMs = 60_000): Repository {
  let cached: { at: number; snap: CatalogSnapshot } | null = null;

  async function load(): Promise<CatalogSnapshot> {
    const [cats, tls, rcs] = await Promise.all([
      query("select slug, name, description, how_to_choose, sort_order from categories order by sort_order"),
      query(
        "select slug, name, category, website, pricing_url, summary, pitch, best_for, watch_out, free_tier, paid_starts_at, free_tier_commercial_use, open_source, self_hostable, baseline, fit, cost, health, verified_on::text as verified_on from tools order by category, baseline",
      ),
      query("select body from recipes order by slug"),
    ]);
    const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);
    return {
      categories: cats.map(
        (r): Category => ({ slug: r.slug, name: r.name, description: r.description, howToChoose: r.how_to_choose, order: r.sort_order }),
      ),
      tools: tls.map(
        (r): Tool => ({
          slug: r.slug,
          name: r.name,
          category: r.category,
          website: r.website,
          pricingUrl: r.pricing_url,
          summary: r.summary,
          pitch: r.pitch,
          bestFor: parse(r.best_for),
          watchOut: parse(r.watch_out),
          freeTier: r.free_tier,
          paidStartsAt: r.paid_starts_at,
          freeTierCommercialUse: r.free_tier_commercial_use,
          openSource: r.open_source,
          selfHostable: r.self_hostable,
          baseline: r.baseline,
          fit: parse(r.fit),
          cost: r.cost ? parse(r.cost) : undefined,
          health: r.health ? parse(r.health) : undefined,
          verifiedOn: r.verified_on,
        }),
      ),
      recipes: rcs.map((r) => parse(r.body) as Recipe),
    };
  }

  return {
    kind: "postgres",
    async snapshot() {
      if (cached && Date.now() - cached.at < cacheMs) return cached.snap;
      const snap = await load();
      cached = { at: Date.now(), snap };
      return snap;
    },
    async logUsage(e) {
      await query(
        "insert into usage_events (tool, recipe, categories, needs, caller_hash) values ($1, $2, $3, $4, $5)",
        [e.tool, e.recipe ?? null, e.categories ?? [], e.needs ?? [], e.callerHash ?? null],
      );
    },
  };
}

let singleton: Repository | null = null;

/** Postgres (Neon serverless driver) when DATABASE_URL is set, otherwise the bundled seed. */
export async function getRepository(): Promise<Repository> {
  if (singleton) return singleton;
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    singleton = postgresRepository(async (text, params) => (await sql.query(text, params ?? [])) as Record<string, any>[]);
  } else {
    singleton = memoryRepository();
  }
  return singleton;
}
