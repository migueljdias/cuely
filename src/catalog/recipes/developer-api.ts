import type { Recipe } from "../types";

const V = "2026-11-20";

export const developerApi: Recipe = {
  slug: "developer-api",
  title: "API or developer tool that other developers pay to call",
  summary:
    "A paid API that developers call with keys: a dashboard where they sign up, create keys and see usage, an API that checks the key and a per-key rate limit on every request, and usage reported to Stripe for metered billing. It runs on Cloudflare Workers close to callers, with Postgres for accounts and keys and Redis for rate limits.",
  matches: [
    "public api", "rest api", "graphql api", "developer api", "api for developers", "api product", "paid api",
    "developer tool", "developer tools", "dev tool", "devtools", "sdk", "per api call", "api-first",
  ],
  fitsWhen: [
    "Customers are developers who call your service from their own code with an API key.",
    "You charge by usage (requests, credits or tokens), by plan with included usage, or both.",
    "Callers are spread out and expect low latency and clear errors.",
  ],
  notFor: [
    "An internal API that only your own app calls: build it into the app instead.",
    "Long-running jobs behind each request (video, big exports): accept the request, queue the work, and return a job id.",
    "An API that moves or holds money for callers: that needs licensing review first.",
  ],
  stack: [
    {
      category: "hosting",
      tool: "cloudflare-workers",
      why: "The API runs close to callers worldwide with no cold starts to speak of, and Workers Free covers 100,000 requests a day while you find your first customers. Workers caps CPU time per request, which suits fast API calls.",
      alternatives: [{ tool: "vercel", when: "The API lives next to a Next.js dashboard and you'd rather run one app." }],
    },
    {
      category: "database",
      tool: "neon",
      why: "Accounts, hashed API keys, plans and usage in Postgres, reached from Workers over HTTP with Neon's serverless driver.",
      alternatives: [{ tool: "supabase", when: "You want database, auth and storage from one vendor." }],
    },
    {
      category: "kv",
      tool: "upstash-redis",
      why: "Per-key rate limits are a counter on every request; Upstash Redis does atomic increments over HTTP from Workers, and its rate-limit SDK has the windows built in.",
      alternatives: [{ tool: "cloudflare-durable-objects", when: "You want rate limits inside Cloudflare with no other vendor." }],
    },
    {
      category: "auth",
      tool: "clerk",
      why: "Sign-in for the developer dashboard only; the API itself checks your own API keys, not sessions.",
      alternatives: [{ tool: "workos-authkit", when: "Customers are companies with teams that need organizations and enterprise SSO." }],
    },
    {
      category: "payments",
      tool: "stripe",
      why: "Metered billing: send each customer's usage to a Stripe Meter and bill per request or credit, with plans that include a free allowance.",
      alternatives: [{ tool: "paddle", when: "You sell worldwide and want a merchant of record to handle sales tax and VAT." }],
    },
    {
      category: "email",
      tool: "resend",
      why: "Key-created notices, usage alerts at 80% and 100%, and invoices.",
      alternatives: [{ tool: "postmark", when: "Transactional deliverability and long retention matter most." }],
    },
    {
      category: "monitoring",
      tool: "sentry",
      why: "Errors and slow requests, tagged with the key's account (never the key itself).",
      alternatives: [{ tool: "better-stack", when: "You want uptime checks and a public status page developers can subscribe to." }],
    },
    {
      category: "jobs",
      tool: "upstash-qstash",
      why: "Delivers webhooks to customers' endpoints with retries and backoff, so a slow customer server doesn't slow your API.",
      alternatives: [{ tool: "inngest", when: "Webhooks are part of longer multi-step workflows." }],
      optional: true,
    },
  ],
  steps: [
    {
      title: "Design the API contract first",
      detail: "Developers judge an API by its first request, its errors and its docs, and changing a public contract later breaks their code.",
      actions: [
        "Write an OpenAPI spec for the first endpoints before coding: paths, request and response schemas, and error shapes.",
        "Version from day one (/v1/...) and never change a field's meaning inside a version.",
        "Use one error format everywhere with a stable code, a message and a link to docs; return 401 for bad keys, 429 with Retry-After for rate limits, 402 or 403 for plan limits.",
        "Make writes safe to retry with an Idempotency-Key header.",
      ],
      check: "The spec validates, and a developer can tell from it alone how to authenticate, what each endpoint returns and what every error means.",
      docs: ["https://spec.openapis.org/oas/latest.html"],
    },
    {
      title: "Issue API keys you can show once and revoke anytime",
      detail: "Store only a hash of each key, show the full key once, and keep a short prefix so developers can tell keys apart.",
      actions: [
        "Create api_keys (account, name, prefix, sha256 hash, created, last used, revoked) and accounts (plan, Stripe customer id).",
        "Generate keys with a recognizable prefix (for example sk_live_) and 32+ random bytes; show the full key once at creation.",
        "Let developers create, name and revoke keys in the dashboard, with separate test and live keys.",
        "Turn on GitHub secret scanning partner patterns for your prefix later, so leaked keys can be reported to you.",
      ],
      files: [
        {
          path: "db/001_keys.sql",
          contents:
            "create table accounts (\n  id uuid primary key default gen_random_uuid(),\n  owner_user_id text not null unique,     -- Clerk user id\n  plan text not null default 'free',\n  stripe_customer_id text unique,\n  created_at timestamptz not null default now()\n);\n\ncreate table api_keys (\n  id bigserial primary key,\n  account_id uuid not null references accounts(id) on delete cascade,\n  name text not null,\n  prefix text not null,                   -- first 12 characters, shown in the dashboard\n  key_hash text not null unique,          -- sha256 of the full key; the key itself is never stored\n  mode text not null check (mode in ('test','live')),\n  last_used_at timestamptz,\n  revoked_at timestamptz,\n  created_at timestamptz not null default now()\n);\n",
        },
        {
          path: "src/keys.ts",
          contents:
            'const enc = new TextEncoder();\n\nexport async function newKey(mode: "test" | "live") {\n  const bytes = crypto.getRandomValues(new Uint8Array(32));\n  const key = `sk_${mode}_${btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)}`;\n  return { key, prefix: key.slice(0, 12), hash: await hashKey(key) };\n}\n\nexport async function hashKey(key: string) {\n  const digest = await crypto.subtle.digest("SHA-256", enc.encode(key));\n  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");\n}\n',
        },
      ],
      check: "A new key works once copied, the database holds only its hash, and a revoked key gets 401 on the next request.",
    },
    {
      title: "Build the API on Workers: check the key, then the rate limit",
      detail: "Every request does the same two cheap checks before any real work.",
      actions: [
        "Scaffold a Worker with a small router (Hono works well) and put the key check and rate limit in middleware.",
        "Look up the key by hash; cache valid keys for a short time so most requests skip the database.",
        "Rate-limit per key with a sliding window in Upstash Redis and return 429 with Retry-After and rate-limit headers.",
        "Keep each request fast: Workers caps CPU time per request, so move heavy work to a queue and return a job id.",
      ],
      commands: ["npm create cloudflare@latest my-api -- --framework=hono", "npm i @neondatabase/serverless @upstash/ratelimit @upstash/redis"],
      files: [
        {
          path: "src/index.ts",
          contents:
            'import { Hono } from "hono";\nimport { Ratelimit } from "@upstash/ratelimit";\nimport { Redis } from "@upstash/redis/cloudflare";\nimport { hashKey } from "./keys";\nimport { findKey, recordUsage } from "./db";\n\ntype Env = { UPSTASH_REDIS_REST_URL: string; UPSTASH_REDIS_REST_TOKEN: string; DATABASE_URL: string };\nconst app = new Hono<{ Bindings: Env; Variables: { accountId: string } }>();\n\napp.use("/v1/*", async (c, next) => {\n  const key = c.req.header("Authorization")?.replace(/^Bearer\\s+/, "");\n  const row = key ? await findKey(c.env, await hashKey(key)) : null;\n  if (!row || row.revoked_at) return c.json({ error: { code: "invalid_api_key", message: "Missing or invalid API key." } }, 401);\n\n  const limiter = new Ratelimit({ redis: Redis.fromEnv(c.env), limiter: Ratelimit.slidingWindow(60, "1 m") });\n  const { success, limit, remaining, reset } = await limiter.limit(String(row.id));\n  c.header("RateLimit-Limit", String(limit));\n  c.header("RateLimit-Remaining", String(remaining));\n  if (!success) {\n    c.header("Retry-After", String(Math.ceil((reset - Date.now()) / 1000)));\n    return c.json({ error: { code: "rate_limited", message: "Too many requests." } }, 429);\n  }\n  c.set("accountId", row.account_id);\n  await next();\n  c.executionCtx.waitUntil(recordUsage(c.env, row.account_id, row.id)); // count after responding\n});\n\napp.get("/v1/hello", (c) => c.json({ ok: true }));\n\nexport default app;\n',
        },
      ],
      check: "A request with no key gets 401, the 61st request in a minute gets 429 with Retry-After, and a normal request answers in under 100 ms from a nearby region.",
      docs: ["https://developers.cloudflare.com/workers/platform/limits/", "https://upstash.com/docs/redis/sdks/ratelimit-ts/overview", "https://neon.com/docs/serverless/serverless-driver"],
    },
    {
      title: "Count usage and bill it through Stripe",
      detail: "Count every billable request cheaply, then send totals to Stripe in batches, never one call per request.",
      actions: [
        "Increment a per-account, per-day usage counter after each billable request (Redis or a usage table).",
        "Create a Stripe Meter and a metered price; from a scheduled job, report each account's new usage with an identifier per batch so retries don't double-bill.",
        "Give the free plan an allowance and enforce it on the server with a clear 402 or 403 error and an upgrade link.",
        "Show usage to date and the projected invoice in the dashboard.",
      ],
      commands: ["npm i stripe"],
      check: "A test account's requests show on its Stripe invoice preview within a day, and the free allowance blocks requests past its limit with an upgrade link.",
      docs: ["https://docs.stripe.com/billing/subscriptions/usage-based", "https://stripe.com/billing/pricing"],
    },
    {
      title: "Build the developer dashboard",
      detail: "Sign-up to first successful request should take a couple of minutes.",
      actions: [
        "Sign in with Clerk; create the account and a test key on first sign-in.",
        "Show a copy-paste curl request with the developer's test key filled in, and the response it returns.",
        "Pages for keys, usage by day, plan and billing (Stripe customer portal), and webhooks if you send them.",
      ],
      check: "A new developer can sign up, copy the sample request and get a 200 from your API in under two minutes.",
      docs: ["https://clerk.com/docs"],
    },
    {
      title: "Publish docs and an SDK",
      detail: "Generate reference docs from the OpenAPI spec so they never drift from the API.",
      actions: [
        "Publish reference docs generated from the spec, plus a quickstart and an errors page that every error links to.",
        "Generate a TypeScript (and Python, if your users want it) client from the spec, or write a thin one.",
        "Add an llms.txt and plain-text docs so coding agents can read them.",
        "Keep a changelog and announce deprecations with dates before removing anything.",
      ],
      check: "Every endpoint in the spec appears in the docs with a working example, and the SDK's example runs against the test key.",
      docs: ["https://llmstxt.org"],
    },
    {
      title: "Send webhooks with signatures and retries",
      detail: "If customers need to know when something happens, sign each webhook and retry failures without blocking your API.",
      actions: [
        "Let developers register endpoint URLs and give each one a signing secret.",
        "Sign the body with HMAC-SHA256 and a timestamp, and document how to verify it.",
        "Deliver through QStash so failed deliveries retry with backoff; every retry counts as a message.",
        "Show recent deliveries and their responses in the dashboard so developers can debug.",
      ],
      commands: ["npm i @upstash/qstash"],
      check: "A webhook to an endpoint that fails twice is delivered on the third try, and the receiving code can verify its signature.",
      docs: ["https://upstash.com/docs/qstash/overall/getstarted"],
    },
    {
      title: "Launch with monitoring and a status page",
      detail: "Developers notice errors and latency before you do, so watch both and tell them when something's wrong.",
      actions: [
        "Add Sentry to the Worker; tag errors with account id, never the API key or request body.",
        "Track error rate and p95 latency per endpoint, and alert on both.",
        "Publish a status page and an email or RSS feed for incidents.",
        "Move to Workers Paid ($5/month) before launch if 10 ms of CPU per request is too little or you'll pass 100,000 requests a day.",
      ],
      check: "You can see error rate and p95 latency per endpoint for the last day, and a test incident shows on the status page.",
      docs: ["https://docs.sentry.io/platforms/javascript/guides/cloudflare/", "https://developers.cloudflare.com/workers/platform/pricing/"],
    },
  ],
  bestPractices: [
    "Store only a hash of each API key, show it once, and let developers revoke it.",
    "Check the key and the rate limit before any real work on every request.",
    "Version the API and never change a field's meaning inside a version.",
    "Use one error format with stable codes, and return Retry-After on 429.",
    "Batch usage reports to Stripe with idempotent identifiers; never report per request.",
    "Generate docs and SDKs from the OpenAPI spec so they match the API.",
  ],
  pitfalls: [
    "Storing API keys in plain text, so one database leak exposes every customer.",
    "Reporting usage to Stripe on every request, which is slow and fails under load.",
    "Rate-limiting per IP instead of per key, so one customer's servers block each other.",
    "Doing heavy work inside the request on Workers and hitting the CPU limit.",
    "Breaking response shapes without a new version and breaking customers' code.",
    "Logging full request bodies or keys in error reports.",
  ],
  complianceNotes: [
    "Publish API terms covering acceptable use, rate limits, uptime promises (if any) and what you do with data sent to the API.",
    "If callers send personal data through the API, you're likely their data processor: offer a data processing agreement and list your vendors.",
    "Keep logs of key creation, revocation and admin actions; enterprise customers will ask in security reviews.",
  ],
  catches: [
    {
      text: "Workers Free allows 100,000 requests a day and 10 ms of CPU time per request; plan to move to Workers Paid ($5/month) before launch if your requests do more work than that.",
      source: "https://developers.cloudflare.com/workers/platform/pricing/",
      verifiedOn: "2026-11-09",
    },
    {
      text: "Upstash Redis Free covers 500K commands a month. A rate-limit check is a few commands, so the free plan runs out around a couple hundred thousand API calls a month; after that it's pay as you go.",
      source: "https://upstash.com/pricing/redis",
      verifiedOn: "2026-11-07",
    },
    {
      text: "Metered billing on Stripe adds Stripe Billing's 0.7% of billing volume on top of card fees.",
      source: "https://stripe.com/pricing",
      verifiedOn: "2026-11-07",
    },
    {
      text: "If you deliver webhooks through QStash, every delivery attempt counts as a message, so retries to a failing customer endpoint add to the bill; Free stops at 1,000 messages a day.",
      source: "https://upstash.com/pricing/qstash",
      verifiedOn: V,
    },
  ],
  costNotes: [
    "Hosting: Workers Free covers 100,000 requests a day; Workers Paid is $5/month when you need more CPU per request or more requests.",
    "Rate limits: about 3 Redis commands per request × 100,000 requests a month = 300K commands, inside Upstash Free's 500K; past that, $0.20 per 100K.",
    "Card fees on what you bill: 2.9% + 30¢ per charge, plus 0.7% of billing volume for Stripe Billing.",
  ],
  verifiedOn: V,
};
