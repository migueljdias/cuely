import type { Tool } from "./types";

/**
 * Tools added on 2026-11-09 for casual and daily web games: fast counters and caches
 * that survive viral traffic spikes, and live results without a realtime service.
 * Every free-plan and price line was read from the vendor's own page (pricingUrl) on
 * that date. Where the page was silent, the field is null or the watch-out says so.
 */
const V = "2026-11-09";

export const gameTools: Tool[] = [
  // ───────────────────────────── Counters and cache ─────────────────────────────
  {
    slug: "upstash-redis",
    name: "Upstash Redis",
    category: "kv",
    website: "https://upstash.com/redis",
    pricingUrl: "https://upstash.com/pricing/redis",
    summary: "Serverless Redis over HTTP, billed per command or as a fixed monthly plan.",
    pitch: "Redis counters, sorted sets and expiring keys over HTTP, so it works from serverless and edge functions.",
    bestFor: ["Vote counts and live tallies", "Leaderboards (sorted sets)", "Streaks and rate limits (keys that expire)", "Caching hot reads"],
    watchOut: [
      "Free stops at 500K commands a month, which a viral day can use in hours; switch to pay as you go and set its budget cap before launch.",
      "The free plan allows 1 database.",
    ],
    freeTier: "Free: 250 MB of data, 500K commands a month, 10 GB of bandwidth a month, 1 database, up to 10,000 commands per second.",
    paidStartsAt:
      "Pay as you go: $0.20 per 100K commands; storage $0.25 per GB after the first 1 GB; bandwidth free up to 200 GB a month, then $0.03/GB. Fixed 250 MB: $10/month with no per-command billing.",
    freeTierCommercialUse: null,
    openSource: false,
    selfHostable: false,
    baseline: 1,
    fit: {
      counters: { weight: 3, reason: "Atomic INCR and HINCRBY for votes, sorted sets for leaderboards, expiring keys for streaks, up to 10,000 commands a second on every plan." },
      spiky: { weight: 2, reason: "Pay as you go absorbs a spike at $0.20 per 100K commands, under a budget cap you set." },
      low_cost: { weight: 2, reason: "Free covers 500K commands a month." },
      nextjs: { weight: 1, reason: "Vercel's own Redis option: Vercel KV is no longer offered and existing stores moved to Upstash." },
      edge: { weight: 1, reason: "HTTP client works from edge runtimes, including Cloudflare Workers." },
    },
    verifiedOn: V,
  },
  {
    slug: "cloudflare-durable-objects",
    name: "Cloudflare Durable Objects",
    category: "kv",
    website: "https://developers.cloudflare.com/durable-objects/",
    pricingUrl: "https://developers.cloudflare.com/durable-objects/platform/pricing/",
    summary: "Single-instance stateful objects on Cloudflare's network, each with its own SQLite storage and WebSockets.",
    pitch: "Strongly consistent state and WebSockets in one place, next to your Workers.",
    bestFor: ["Everything on Cloudflare", "Pushing live updates over WebSockets", "Per-room or per-question state"],
    watchOut: [
      "You write the counting, sharding and leaderboard code yourself; there are no Redis-style commands.",
      "One object has a soft limit of 1,000 requests a second, so a big spike needs counters split across objects.",
    ],
    freeTier:
      "On Workers Free (SQLite-backed objects only): 100,000 requests a day, 13,000 GB-s of duration a day, 5 million rows read and 100,000 rows written a day, 5 GB stored in total. Past any limit, further operations fail with an error until 00:00 UTC.",
    paidStartsAt:
      "On Workers Paid ($5/month account minimum): 1M requests a month, then $0.15 per million; 400,000 GB-s, then $12.50 per million GB-s; 50M rows written, then $1.00 per million; 5 GB-month, then $0.20 per GB-month.",
    freeTierCommercialUse: null,
    openSource: false,
    selfHostable: false,
    baseline: 2,
    fit: {
      counters: { weight: 2, reason: "One object per question counts votes with strong consistency in its own SQLite storage." },
      realtime: { weight: 2, reason: "The same object can hold players' WebSockets; with the Hibernation API idle connections aren't billed for duration, and incoming messages bill at 20:1." },
      edge: { weight: 2, reason: "Runs on Cloudflare's network beside your Workers." },
      low_cost: { weight: 2, reason: "Included on Workers Free: 100,000 requests and 100,000 rows written a day." },
      nextjs: { weight: -1, reason: "Lives on Cloudflare Workers; an app on Vercel has to call it over HTTP." },
    },
    verifiedOn: V,
  },
  {
    slug: "cloudflare-kv",
    name: "Cloudflare Workers KV",
    category: "kv",
    website: "https://developers.cloudflare.com/kv/",
    pricingUrl: "https://developers.cloudflare.com/kv/platform/pricing/",
    summary: "A global, eventually consistent key-value store for Workers, built for many reads and few writes.",
    pitch: "Cheap global reads for data that changes rarely, such as today's question or yesterday's final results.",
    bestFor: ["Caching read-mostly data at the edge", "Config and content that changes a few times a day"],
    watchOut: [
      "Writes to the same key are limited to 1 per second, and a change can take 60 seconds or more to show in other locations, so it can't count votes.",
    ],
    freeTier:
      "Workers Free: 100,000 reads, 1,000 writes, 1,000 deletes and 1,000 lists a day, 1 GB stored. Past a limit, operations of that type fail until 00:00 UTC.",
    paidStartsAt:
      "Workers Paid ($5/month minimum): 10M reads a month, then $0.50 per million; 1M writes, then $5.00 per million; 1 GB, then $0.50 per GB-month.",
    freeTierCommercialUse: null,
    openSource: false,
    selfHostable: false,
    baseline: 3,
    fit: {
      counters: { weight: -3, reason: "1 write per second to the same key, and changes take up to 60 seconds or more to show everywhere, so it can't hold a live tally." },
      edge: { weight: 3, reason: "Reads are served from Cloudflare's network close to every player." },
      spiky: { weight: 1, reason: "Paid includes 10 million reads a month, then $0.50 per million." },
      low_cost: { weight: 1, reason: "Free covers 100,000 reads and 1,000 writes a day." },
    },
    verifiedOn: V,
  },
  {
    slug: "vercel-global-config",
    name: "Vercel Global Config (formerly Edge Config)",
    category: "kv",
    website: "https://vercel.com/docs/global-config",
    pricingUrl: "https://vercel.com/docs/global-config/global-config-limits",
    summary: "A small read-optimized store on Vercel for flags, redirects and blocklists, read in under a millisecond.",
    pitch: "Instant reads of small config from Vercel functions and middleware.",
    bestFor: ["Feature flags and A/B tests", "Redirects and IP blocklists", "Today's question id or a kill switch"],
    watchOut: [
      "Vercel says to avoid it for frequently updated data: writes take up to 10 seconds to reach every region, and Hobby includes 100 writes a month.",
      "Each store is capped at 1 MB on every plan.",
    ],
    freeTier: "Hobby: 1 store of up to 1 MB, the first 100,000 reads and 100 writes a month.",
    paidStartsAt: "On demand: $3 per million reads and $1 per 100 writes.",
    freeTierCommercialUse: null,
    openSource: false,
    selfHostable: false,
    baseline: 4,
    fit: {
      counters: { weight: -3, reason: "Built for data that changes rarely; writes take up to 10 seconds to propagate and cost $1 per 100." },
      nextjs: { weight: 2, reason: "Reads from Vercel functions and middleware typically complete in under a millisecond." },
      edge: { weight: 2, reason: "Replicated to every Vercel region for reads." },
    },
    verifiedOn: V,
  },
  {
    slug: "redis-cloud",
    name: "Redis Cloud",
    category: "kv",
    website: "https://redis.io/cloud/",
    pricingUrl: "https://redis.io/pricing/",
    summary: "Managed Redis from Redis, sized by memory rather than billed per command.",
    pitch: "Full Redis from its maker, at a flat price per memory size.",
    bestFor: ["Teams that want Redis from the company that makes it", "Steady traffic where a flat price beats per-command billing"],
    watchOut: [
      "Free is a 30 MB database on shared infrastructure with a best-effort SLA.",
      "The pricing page doesn't state operations-per-second or connection limits; check the plan before a launch.",
    ],
    freeTier: "Free: one 30 MB database on a shared cloud deployment, best-effort SLA.",
    paidStartsAt: "Essentials: from $0.007/hour, about $5/month (250 MB to 100 GB).",
    freeTierCommercialUse: null,
    openSource: false,
    selfHostable: false,
    baseline: 5,
    fit: {
      counters: { weight: 2, reason: "Full Redis: INCR, sorted sets and expiring keys." },
      low_cost: { weight: -1, reason: "Free is 30 MB; paid starts at about $5 a month." },
      spiky: { weight: -1, reason: "Plans are sized by memory and the page states no throughput limits, so headroom for a spike is unclear." },
    },
    verifiedOn: V,
  },

  // ───────────────────────────── Realtime ─────────────────────────────
  {
    slug: "cached-polling",
    name: "Cached polling (no realtime service)",
    category: "realtime",
    website: "https://vercel.com/docs/caching/cdn-cache",
    pricingUrl: "https://vercel.com/pricing",
    summary: "Clients re-fetch one results endpoint every few seconds, and the host caches its answer so every player shares it.",
    pitch: "Live-enough numbers for crowds with no extra vendor: one cached endpoint, polled every few seconds.",
    bestFor: ["Live vote percentages and leaderboards", "Traffic that spikes when something is shared", "Staying on one bill"],
    watchOut: [
      "Players see numbers up to the cache time old (a few seconds); use a push service for chat, cursors or fast multiplayer.",
    ],
    freeTier:
      "No service to sign up for. On Vercel, a function response with Cache-Control: s-maxage is served from the CDN, and a cached response doesn't run the function; on Cloudflare Workers, cache the answer with the Cache API, and each poll is a Worker request.",
    paidStartsAt: null,
    freeTierCommercialUse: null,
    openSource: false,
    selfHostable: true,
    baseline: 5,
    fit: {
      spiky: { weight: 3, reason: "Every player reads the same cached answer, so a viral day adds cheap cached requests, not connections or messages." },
      low_cost: { weight: 2, reason: "No extra vendor or bill." },
      counters: { weight: 2, reason: "Fits tallies and leaderboards that only need to be a few seconds fresh." },
      realtime: { weight: -1, reason: "Updates every few seconds rather than instantly: fine for crowd numbers, not for presence, chat or shared editing." },
    },
    verifiedOn: V,
  },
];
