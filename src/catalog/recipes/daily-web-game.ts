import type { Recipe } from "../types";

const V = "2026-11-09";

export const dailyWebGame: Recipe = {
  slug: "daily-web-game",
  title: "Casual or daily web game that survives viral spikes",
  summary:
    "A game that runs in the browser with one shared puzzle or question a day: players vote or answer, see live crowd numbers, keep streaks and share their result. Static pages on Cloudflare Workers, vote counts and streaks in Upstash Redis, every vote stored in Neon Postgres, and live numbers from one cached results endpoint instead of a realtime service.",
  matches: [
    "daily game", "web game", "browser game", "daily puzzle", "daily question", "puzzle game", "word game", "trivia",
    "voting game", "guessing game", "wordle", "game", "games", "leaderboard", "streaks",
  ],
  fitsWhen: [
    "The game runs in a web browser and a round is short (seconds to a few minutes).",
    "Everyone plays the same puzzle or question each day, so most reads are the same for every player.",
    "Players share results, so traffic can jump from hundreds to tens of thousands in a day.",
  ],
  notFor: [
    "Games built in an engine (Unity, Unreal, Godot), console or 3D games, or phone games: Cuely doesn't cover those.",
    "Fast real-time multiplayer (shooters, racing, anything that needs an authoritative game server and matchmaking).",
    "Games that sell items or subscriptions inside an iOS or Android app: the stores' in-app purchase rules apply (see the mobile-subscription-app recipe).",
  ],
  stack: [
    {
      category: "hosting",
      tool: "cloudflare-workers",
      why: "Static assets are free and unlimited, so a viral day of page loads costs nothing, and Workers Paid ($5/month) includes 10 million API requests a month, then $0.30 per million. Move to Paid before you share the game: on Free, requests past 100,000 a day get error 1027.",
      alternatives: [
        { tool: "vercel", when: "You build it in Next.js and want Vercel's tooling: Pro ($20/month) has a flat-rate CDN, and a cached results response doesn't run your function. Hobby is non-commercial and stops for 30 days once you pass 1M CDN requests a month." },
      ],
    },
    {
      category: "kv",
      tool: "upstash-redis",
      why: "Atomic counters for the tally, SET with NX to stop double votes, sorted sets for leaderboards and expiring keys for streaks, at up to 10,000 commands a second, over HTTP from Workers.",
      alternatives: [
        { tool: "cloudflare-durable-objects", when: "You want everything on Cloudflare and to push results over WebSockets; you write the counting code yourself and split counters across objects past 1,000 requests a second." },
        { tool: "redis-cloud", when: "You'd rather pay a flat price by memory size than per command." },
      ],
    },
    {
      category: "database",
      tool: "neon",
      why: "The durable record: every vote, each day's question and final results, in Postgres you can query and recompute streaks from. Its serverless driver connects from Workers over HTTP, and scale-to-zero keeps quiet days free.",
      alternatives: [{ tool: "supabase", when: "You also want its auth and storage from one dashboard; free projects pause after a week with no activity." }],
    },
    {
      category: "realtime",
      tool: "cached-polling",
      why: "Every player needs the same numbers, so serve them from one endpoint cached for 5 seconds and poll it while the results screen is open. A spike adds cheap cached requests, not connections.",
      alternatives: [
        { tool: "supabase-realtime", when: "You need updates under a second and expect at most 200 players at once on Free (500 on Pro)." },
        { tool: "ably", when: "You need pushed updates with delivery guarantees and can pay by monthly active users (500 free, then from $29/month for 1,000)." },
      ],
    },
    {
      category: "auth",
      tool: "better-auth",
      why: "Start with no sign-in: an anonymous player id kept in the browser. When players want streaks on more than one device, add Better Auth (its anonymous plugin lets a guest upgrade to an account); users stay in your Neon database with no per-user fees.",
      alternatives: [{ tool: "clerk", when: "You want prebuilt sign-in screens; free up to 50,000 retained users." }],
      optional: true,
    },
    {
      category: "monitoring",
      tool: "sentry",
      why: "Error alerts on the vote and results endpoints, so you hear about a failure on the viral day, not the day after.",
      alternatives: [{ tool: "better-stack", when: "You also want an uptime check on the results endpoint." }],
    },
    {
      category: "analytics",
      tool: "posthog",
      why: "Daily players, how many come back the next day, and which shares bring new players.",
      alternatives: [{ tool: "plausible", when: "Page and referrer counts are enough." }],
      optional: true,
    },
  ],
  steps: [
    {
      title: "Decide the day, the player and the one rule for votes",
      detail: "Three decisions shape every table and key: when a day starts, how you know a player, and how you stop double votes.",
      actions: [
        "Pick one day boundary for everyone (midnight UTC is simplest, and Cron Triggers run on UTC) and show the countdown in the player's local time.",
        "Use an anonymous player id: a random id created in the browser on first visit and kept in localStorage. Don't ask for sign-in to play.",
        "Make the rule 'one vote per player per day', enforced on the server with SET NX in Redis and a primary key in Postgres, never only in the browser.",
        "Write the first 30 days of questions before launch; a daily game that skips a day loses its streak players.",
      ],
      check: "You can say, in one sentence each, when a day starts, what a player id is, and what happens on a second vote.",
      docs: ["https://developers.cloudflare.com/workers/configuration/cron-triggers/"],
    },
    {
      title: "Create the Worker with static assets",
      detail: "The game page, scripts and images are static assets, which are free and unlimited. Only /api/* runs your code.",
      actions: [
        "Create a Workers project and put the game's HTML, JS and images in a public folder served as static assets.",
        "Send only /api/vote and /api/results to the Worker script; everything else is a file.",
        "Upgrade the account to Workers Paid ($5/month) before you share the game anywhere.",
      ],
      commands: [
        "npm create cloudflare@latest -- daily-game",
        "cd daily-game && npm i @upstash/redis @neondatabase/serverless",
        "npx wrangler deploy",
      ],
      files: [
        {
          path: "wrangler.jsonc",
          contents:
            '{\n  "name": "daily-game",\n  "main": "src/index.ts",\n  "compatibility_date": "2026-11-01",\n  "assets": { "directory": "./public" },\n  // Roll the day over at midnight UTC (step 6).\n  "triggers": { "crons": ["0 0 * * *"] }\n}\n',
        },
      ],
      check: "The deployed URL serves the game page, and the Workers dashboard counts requests only for /api calls, not page loads.",
      docs: [
        "https://developers.cloudflare.com/workers/get-started/guide/",
        "https://developers.cloudflare.com/workers/static-assets/",
        "https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/",
      ],
    },
    {
      title: "Set up Upstash Redis and the Postgres tables",
      detail: "Redis holds what changes every second (tallies, who voted today, streaks). Postgres holds what you must never lose (every vote, every question, final results).",
      actions: [
        "Create an Upstash Redis database in the region closest to most players and switch it to pay as you go with a monthly budget before launch.",
        "Add UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN and DATABASE_URL as Worker secrets with `npx wrangler secret put`.",
        "Create a Neon project and run the schema below.",
        "Key names in Redis: q:{day} (today's question), voted:{day}:{player} (dedupe, expires after 2 days), tally:{day} (a hash of choice to count), streak:{player} (last day and count), rl:{ip} (rate limit, expires after 60 seconds).",
      ],
      files: [
        {
          path: "db/001_game.sql",
          contents:
            "create table questions (\n  day date primary key,\n  prompt text not null,\n  choices text[] not null check (array_length(choices, 1) between 2 and 6)\n);\n\n-- Every vote, once per player per day.\ncreate table votes (\n  day date not null references questions(day),\n  player_id text not null,\n  choice text not null,\n  created_at timestamptz not null default now(),\n  primary key (day, player_id)\n);\ncreate index votes_by_player on votes (player_id, day desc);\n\n-- Copied from Redis when the day ends.\ncreate table final_results (\n  day date primary key references questions(day),\n  tally jsonb not null,\n  total integer not null\n);\n",
        },
      ],
      check: "Inserting the same (day, player_id) twice fails on the primary key, and the Worker can read and write a test key in Redis.",
      docs: [
        "https://upstash.com/docs/redis/sdks/ts/deployment",
        "https://neon.com/docs/guides/cloudflare-workers",
      ],
    },
    {
      title: "Write the vote endpoint",
      detail: "Count in Redis and answer the player at once; write the durable row after the response with waitUntil.",
      actions: [
        "Rate-limit by IP with a short-lived counter (INCR plus EXPIRE 60), or Upstash's @upstash/ratelimit, so one script can't stuff the tally.",
        "Validate the player id format and that the choice is one of today's choices.",
        "SET voted:{day}:{player} with NX; if it already exists, don't count again.",
        "HINCRBY tally:{day} {choice} 1, then update the streak (a last day of yesterday means +1, anything older resets to 1).",
        "Insert the vote into Postgres inside ctx.waitUntil, with ON CONFLICT DO NOTHING.",
      ],
      files: [
        {
          path: "src/index.ts",
          contents:
            'import { Redis } from "@upstash/redis/cloudflare";\nimport { neon } from "@neondatabase/serverless";\n\nexport interface Env {\n  UPSTASH_REDIS_REST_URL: string;\n  UPSTASH_REDIS_REST_TOKEN: string;\n  DATABASE_URL: string;\n}\n\nconst dayOf = (d = new Date()) => d.toISOString().slice(0, 10); // the game day, in UTC\nconst yesterday = () => dayOf(new Date(Date.now() - 86_400_000));\n\nexport default {\n  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {\n    const redis = Redis.fromEnv(env);\n    const { pathname } = new URL(req.url);\n    if (pathname === "/api/vote" && req.method === "POST") return vote(req, env, ctx, redis);\n    if (pathname === "/api/results") return results(req, ctx, redis);\n    return new Response("Not found", { status: 404 });\n  },\n};\n\nasync function vote(req: Request, env: Env, ctx: ExecutionContext, redis: Redis) {\n  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";\n  const hits = await redis.incr(`rl:${ip}`);\n  if (hits === 1) await redis.expire(`rl:${ip}`, 60);\n  if (hits > 30) return new Response("Slow down", { status: 429 });\n\n  const { playerId, choice } = (await req.json()) as { playerId: string; choice: string };\n  const day = dayOf();\n  const q = await redis.get<{ choices: string[] }>(`q:${day}`);\n  if (!q || !q.choices.includes(choice) || !/^[A-Za-z0-9-]{16,64}$/.test(playerId)) {\n    return new Response("Bad vote", { status: 400 });\n  }\n\n  // One vote per player per day.\n  const first = await redis.set(`voted:${day}:${playerId}`, choice, { nx: true, ex: 172_800 });\n  if (!first) return Response.json({ ok: true, alreadyVoted: true });\n\n  await redis.hincrby(`tally:${day}`, choice, 1);\n  const s = await redis.hgetall<{ last: string; count: number }>(`streak:${playerId}`);\n  const count = s?.last === yesterday() ? Number(s.count) + 1 : 1;\n  await redis.hset(`streak:${playerId}`, { last: day, count });\n\n  // The durable record, written after the player has their answer.\n  const sql = neon(env.DATABASE_URL);\n  ctx.waitUntil(sql`insert into votes (day, player_id, choice) values (${day}, ${playerId}, ${choice}) on conflict do nothing`);\n  return Response.json({ ok: true, streak: count });\n}\n\nasync function results(req: Request, ctx: ExecutionContext, redis: Redis) {\n  // One cached answer per Cloudflare location, refreshed every 5 seconds.\n  const key = new Request(new URL("/api/results", req.url).toString());\n  const hit = await caches.default.match(key);\n  if (hit) return hit;\n  const day = dayOf();\n  const tally = (await redis.hgetall<Record<string, number>>(`tally:${day}`)) ?? {};\n  const total = Object.values(tally).reduce((a, b) => a + Number(b), 0);\n  const percent = Object.fromEntries(\n    Object.entries(tally).map(([k, v]) => [k, total ? Math.round((Number(v) / total) * 1000) / 10 : 0]),\n  );\n  const res = Response.json({ day, total, percent }, { headers: { "Cache-Control": "public, max-age=5" } });\n  ctx.waitUntil(caches.default.put(key, res.clone()));\n  return res;\n}\n',
        },
      ],
      check: "Voting twice from the same player id leaves the tally unchanged, and the votes table gets exactly one row.",
      docs: [
        "https://developers.cloudflare.com/workers/runtime-apis/context/",
        "https://upstash.com/docs/redis/sdks/ratelimit-ts/overview",
        "https://neon.com/docs/serverless/serverless-driver",
      ],
    },
    {
      title: "Show live percentages by polling the cached endpoint",
      detail: "The results endpoint caches one answer per Cloudflare location for 5 seconds (the Cache API doesn't replicate between locations), so heavy polling reaches Redis only a few times a second.",
      actions: [
        "After a player votes, show the percentages and poll /api/results every 5 seconds.",
        "Poll only while the tab is visible (document.visibilityState) and stop after a few minutes on the page.",
        "Never put anything player-specific (their own vote or streak) in the shared results response; return those from the vote call instead.",
      ],
      files: [
        {
          path: "public/results.js",
          contents:
            'export function watchResults(render) {\n  const stopAt = Date.now() + 3 * 60_000;\n  async function tick() {\n    if (document.visibilityState === "visible") {\n      const res = await fetch("/api/results");\n      if (res.ok) render(await res.json());\n    }\n    if (Date.now() < stopAt) setTimeout(tick, 5000);\n  }\n  tick();\n}\n',
        },
      ],
      check: "With the results screen open in two browsers, a vote in one shows in the other within about 10 seconds.",
      docs: ["https://developers.cloudflare.com/workers/runtime-apis/cache/"],
    },
    {
      title: "Roll the day over on a schedule",
      detail: "A Cron Trigger at midnight UTC loads the new question and saves yesterday's final tally, so the game never depends on someone being awake.",
      actions: [
        "Add a scheduled() handler that reads the new day's question from Postgres and writes it to q:{day} in Redis.",
        "In the same run, copy yesterday's tally hash into final_results in Postgres.",
        "If no question exists for the new day, report it to Sentry and show a friendly 'back tomorrow' page rather than an error.",
      ],
      check: "Running the scheduled handler locally for a test date loads that day's question and writes the previous day's final_results row.",
      docs: ["https://developers.cloudflare.com/workers/configuration/cron-triggers/"],
    },
    {
      title: "Make sharing the growth loop",
      detail: "Players share a short text result with a link. That text is what spreads, and it costs nothing to make.",
      actions: [
        "Build the share text in the browser: the game's name and day number, the player's pick, how much of the crowd agreed, the streak, and the link.",
        "Call navigator.share() from the Share button where the browser supports it, and fall back to navigator.clipboard.writeText() with a 'Copied' message. Both need HTTPS.",
        "Give each day its own page with an og:image, made once when you write the question and saved as a static asset, so link previews never run code.",
        "Keep each past day's results page up, since late clicks on shared links land there.",
      ],
      check: "Pasting a shared link in a chat app shows the day's preview image, and the Share button works on a phone and on a desktop browser.",
      docs: [
        "https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share",
        "https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText",
      ],
    },
    {
      title: "Get ready for the viral day",
      detail: "Every free plan in this stack stops or errors at its cap. Set the plans, caps and alerts before the spike, not during it.",
      actions: [
        "Confirm Workers Paid is on.",
        "Confirm Upstash is on pay as you go with a budget, and Neon's compute has a maximum size set.",
        "Add Sentry to the Worker and alert on a jump in errors for /api/vote.",
        "Send a few thousand test votes from a script against a preview deployment and check that the tally, the votes table and the cached results agree.",
      ],
      check: "A test of a few thousand votes in a minute finishes with no errors, matching counts in Redis and Postgres, and a results endpoint that still answers from cache.",
      docs: [
        "https://developers.cloudflare.com/workers/platform/limits/",
        "https://upstash.com/pricing/redis",
      ],
    },
  ],
  bestPractices: [
    "Count in Redis, store in Postgres: the tally is fast and can be rebuilt; the votes table is the truth.",
    "Serve everything that's the same for every player from cache, and keep per-player answers out of shared responses.",
    "Let people play without signing in; offer sign-in only to keep streaks across devices.",
    "Keep past days' results as permanent pages, since shared links keep arriving for days.",
    "Write questions weeks ahead and keep a few spares for a day you can't.",
  ],
  pitfalls: [
    "Counting with SELECT count(*) on every page view: under a spike, the database becomes the bottleneck.",
    "Keeping the tally in Cloudflare KV or Vercel Global Config: both are built for rare writes (KV allows 1 write per second per key).",
    "Opening a WebSocket per player for numbers that change every few seconds: free realtime plans allow connections in the hundreds.",
    "Launching on a free plan that stops at its cap: Workers Free errors after 100,000 requests a day; Vercel Hobby stops for 30 days past its limits.",
    "Trusting the browser to prevent double votes: enforce it on the server.",
    "A server-side day boundary in local time that nobody wrote down: players in different time zones see different days.",
  ],
  complianceNotes: [
    "If the game is aimed at children under 13 in the US, COPPA applies before you collect any identifier; get advice before launch.",
    "An anonymous player id and analytics cookies can still be personal data under GDPR for EU players; say what you store in a privacy policy and ask for consent where analytics needs it.",
    "Don't keep IP addresses longer than the rate limit needs.",
  ],
  catches: [
    {
      text: "Workers Free has a daily limit of 100,000 requests; past it Cloudflare returns error 1027 (or skips your Worker if the route fails open). Workers Paid is $5/month with 10M requests included, then $0.30 per million.",
      source: "https://developers.cloudflare.com/workers/platform/limits/",
      verifiedOn: V,
    },
    {
      text: "Requests to static assets on Workers are free and unlimited; only requests that run your Worker script are billed.",
      source: "https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/",
      verifiedOn: V,
    },
    {
      text: "Upstash Redis Free is 500K commands a month; pay as you go is $0.20 per 100K with a budget you set, and every plan allows up to 10,000 commands a second.",
      source: "https://upstash.com/pricing/redis",
      verifiedOn: V,
    },
    {
      text: "Cloudflare KV allows 1 write per second to the same key, and changes can take 60 seconds or more to show in other locations, so it can't hold a live tally.",
      source: "https://developers.cloudflare.com/kv/concepts/how-kv-works/",
      verifiedOn: V,
    },
    {
      text: "On Vercel Hobby, going over the included usage (1M CDN requests a month) means waiting 30 days to use that feature again. Pro has a flat-rate CDN, and a cached function response doesn't run the function.",
      source: "https://vercel.com/docs/plans/hobby",
      verifiedOn: V,
    },
  ],
  costOverrides: {
    "cloudflare-workers": {
      monthly: 5,
      basis: "Workers Paid from launch day ($5/month, 10M requests included, then $0.30 per million): Free stops at 100,000 requests a day.",
    },
  },
  costNotes: [
    "Steady state at 1,000 daily players: about $5/month, all of it Workers Paid; Upstash, Neon, Sentry and PostHog stay on their free plans.",
    "A viral day of 100,000 players who each vote once and watch results for 2 minutes (one poll every 5 seconds): page loads are static assets (free), and 100,000 votes + 2.4M polls is about 2.5M Worker requests, a quarter of Workers Paid's 10M a month (then $0.30 per million).",
    "Upstash on that day: about 6 commands per vote (rate limit, today's question, dedupe, tally, streak read and write) is 600K, and the 5-second cache keeps results reads small. At $0.20 per 100K that's about $1.20 to $1.50 for the day on pay as you go.",
    "Neon on that day: 100,000 small inserts sent after each response is light work; watch compute hours (Free has 100 CU-hours a month per project).",
  ],
  verifiedOn: V,
};
