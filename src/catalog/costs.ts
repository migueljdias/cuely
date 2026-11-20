import type { ToolCost } from "./types";

/**
 * Cuely's published usage profile. Every tool's monthly cost below is worked out
 * for this profile from the free-plan and price facts in its catalog entry, so
 * stacks can be compared on one number. Agents can redo the math for other numbers
 * from each basis line.
 */
export const COST_PROFILE = {
  users: 1000,
  text:
    "1,000 monthly active users with light use: about 100,000 requests, 3,000 emails, 200,000 analytics events and 5 GB of stored files a month, and a database under 1 GB. AI apps add 50 questions per user a month at about 4,000 input and 500 output tokens each (200M input and 25M output tokens). Internal tools are priced for 10 staff instead.",
  /** Product types whose cost doesn't use the 1,000-user profile. */
  internalStaff: 10,
};

/** Monthly cost at COST_PROFILE, by tool slug. Computed 2026-11-07 from the catalog facts. */
export const COSTS: Record<string, ToolCost> = {
  // Hosting
  vercel: { monthly: 20, basis: "Pro $20/month (Hobby can't be used for a product that charges or serves a business); the profile fits in the included $20 usage credit." },
  "cloudflare-workers": { monthly: 0, basis: "100,000 requests a month fits the free 100,000 requests a day; $5/month Paid if 10 ms CPU per request is too little." },
  netlify: { monthly: 9, basis: "Free credits run out after about 20 production deploys a month; Personal is $9/month for 1,000 credits." },
  render: { monthly: 7, basis: "Free instances spin down when idle and aren't for production; the smallest paid web service is $7/month." },
  // Database
  neon: { monthly: 0, basis: "Free covers 1 GB and 100 CU-hours a month; past that, pay as you go at $0.106 per CU-hour with no minimum." },
  supabase: { monthly: 0, basis: "Free covers 500 MB and 50,000 MAU; Pro is $25/month when you need more or don't want a pause after a quiet week." },
  turso: { monthly: 0, basis: "Free covers 5 GB and 500M rows read a month." },
  firebase: { monthly: 0, basis: "Spark covers 50,000 Firestore reads and 20,000 writes a day; heavy readers move to Blaze, pay as you go." },
  // Auth
  "workos-authkit": { monthly: 0, basis: "First 1M MAU free; SSO is $125 per connection when a customer asks for it." },
  clerk: { monthly: 0, basis: "Hobby covers 50,000 retained users; custom roles and other B2B features are a $100/month add-on." },
  "better-auth": { monthly: 0, basis: "Open-source library, no per-user cost." },
  "supabase-auth": { monthly: 0, basis: "Free covers 50,000 MAU." },
  "neon-auth": { monthly: 0, basis: "Included with Neon; up to 60,000 MAU per project on Free." },
  // Payments
  stripe: { monthly: 0, basis: "No monthly fee.", variable: "2.9% + 30¢ per card charge, plus 0.7% of billing volume for subscriptions" },
  paddle: { monthly: 0, basis: "No monthly fee; tax handled as merchant of record.", variable: "5% + 50¢ per transaction" },
  "lemon-squeezy": { monthly: 0, basis: "No monthly fee.", variable: "5% + 50¢ per transaction, plus surcharges" },
  revenuecat: { monthly: 0, basis: "Free up to $2,500 monthly tracked revenue, then 1% of tracked revenue.", variable: "store commission (Apple 15% under the Small Business Program; Google Play 10% + 5% billing fee on US subscriptions), plus RevenueCat 1% above $2,500 a month" },
  "stripe-connect": { monthly: 0, basis: "No monthly fee when Stripe handles pricing; $2 per monthly active provider account if you handle pricing.", variable: "2.9% + 30¢ per card charge; if you handle pricing, also 0.25% + 25¢ per payout" },
  // Email
  resend: { monthly: 20, basis: "3,000 emails a month hits the free 100-a-day cap on busy days; Pro is $20/month for 50,000." },
  postmark: { monthly: 15, basis: "Free is 100 emails a month; Basic is $15/month for 10,000." },
  "amazon-ses": { monthly: 0.3, basis: "3,000 emails at $0.10 per 1,000." },
  // Secrets, DNS
  infisical: { monthly: 0, basis: "Free covers 5 identities." },
  doppler: { monthly: 0, basis: "Free for 3 users." },
  "cloudflare-dns": { monthly: 0, basis: "DNS is free." },
  "amazon-route-53": { monthly: 0.5, basis: "$0.50 per hosted zone; queries at this volume cost cents." },
  // Monitoring, analytics
  sentry: { monthly: 0, basis: "Developer covers 5,000 errors a month for 1 user; Team is $29/month for more people." },
  "better-stack": { monthly: 0, basis: "Free covers 10 monitors." },
  posthog: { monthly: 0, basis: "200,000 events fits the free 1M a month." },
  plausible: { monthly: 9, basis: "Starter is $9/month for 10,000 pageviews; busier sites need a higher tier." },
  "vercel-web-analytics": { monthly: 6, basis: "200,000 events at $0.03 per 1,000 on Pro." },
  // Storage
  "cloudflare-r2": { monthly: 0, basis: "5 GB fits the free 10 GB-month, and R2 has no egress fees." },
  "vercel-blob": { monthly: 0.12, basis: "5 GB at $0.023/GB on Pro, plus transfer." },
  "amazon-s3": { monthly: 0.12, basis: "5 GB at about $0.023/GB, plus transfer above 100 GB a month." },
  // AI model APIs: 200M input + 25M output tokens a month
  "gemini-api": { monthly: 487.5, basis: "Gemini 3.8 Flash from January 1, 2027: 200M input × $1.50 + 25M output × $7.50 per million = $487.50 ($243.75 at the price through December 31, 2026). Use the paid tier for customer data." },
  "claude-api": { monthly: 650, basis: "Sonnet 5.5: 200M input × $2 + 25M output × $10 per million = $650. Haiku 5.5 for the same traffic: $20 + $12.50 = about $33." },
  "openai-api": { monthly: 650, basis: "gpt-6.1-sol: 200M input × $2 + 25M output × $10 per million = $650. gpt-6-luna: about $33." },
  // Vector search
  pgvector: { monthly: 0, basis: "Included in your Postgres; ~50,000 chunks of 1,024-dim vectors is roughly 0.2 GB of storage." },
  pinecone: { monthly: 0, basis: "Starter covers 2 GB and 1M read units a month." },
  turbopuffer: { monthly: 16, basis: "Launch has a $16/month minimum." },
  // Realtime
  liveblocks: { monthly: 0, basis: "Free covers 500 monthly active rooms and unlimited users; Pro is $25/month billed annually beyond that." },
  "supabase-realtime": { monthly: 0, basis: "Free covers 200 concurrent connections and 2M messages a month." },
  ably: { monthly: 29, basis: "Free stops at 500 MAU; Pro from $29/month covers 1,000 MAU (billed annually)." },
  pusher: { monthly: 49, basis: "Sandbox allows 100 concurrent connections; Startup is $49/month for 500." },
  "cached-polling": { monthly: 0, basis: "No separate bill; each poll is a cached CDN request on Vercel or a Worker request on Cloudflare." },
  // Counters and cache (read 2026-11-09)
  "upstash-redis": { monthly: 0, basis: "About 3 commands per request × 100,000 requests = 300K commands, inside the free 500K; past that, $0.20 per 100K." },
  "cloudflare-durable-objects": { monthly: 0, basis: "100,000 requests a month fits the free 100,000 a day." },
  "cloudflare-kv": { monthly: 0, basis: "One read per request fits the free 100,000 reads a day." },
  "vercel-global-config": { monthly: 0, basis: "One read per request is 100,000 reads, the Hobby allowance; on-demand reads are $3 per million." },
  "redis-cloud": { monthly: 0, basis: "Counters and a leaderboard fit in the free 30 MB; Essentials is about $5/month for more." },
  // Mobile builds
  "expo-eas": { monthly: 19, basis: "Free updates reach 1,000 MAU, so you're at the limit; Starter is $19/month for 3,000. Builds fit the free 15 + 15 a month." },
  "native-toolchains": { monthly: 0, basis: "Tools are free; store fees are listed separately." },
  // Push notifications
  "expo-push": { monthly: 0, basis: "Expo states there's no cost to send through its push service." },
  "firebase-cloud-messaging": { monthly: 0, basis: "Firebase lists Cloud Messaging as no-cost on Spark and Blaze." },
  onesignal: { monthly: 31, basis: "Free covers up to 1,000 monthly active mobile users, so you're at the limit; Growth is $19/month + $0.012 × 1,000 MAU = $31." },
  "apns-direct": { monthly: 0, basis: "Apple lists no per-notification price; the $99/year Apple Developer Program is listed with the store fees." },
  "xcode-cloud": { monthly: 0, basis: "25 compute hours a month come with the Apple Developer Program, whose $99 a year is listed with the store fees; 100 hours a month is US$49.99." },
  // Internal tools: 10 staff
  retool: { monthly: 55, scale: "10_staff", basis: "Free stops at 5 users; Team for 1 builder ($10) + 9 staff ($5 each) = $55/month, billed annually." },
  appsheet: { monthly: 0, scale: "10_staff", basis: "$0 if your Workspace plan includes AppSheet Core; otherwise Starter at $5 × 10 staff = $50/month." },
  airtable: { monthly: 200, scale: "10_staff", basis: "Team at $20 per seat × 10 staff = $200/month, billed annually." },
  glide: { monthly: 25, scale: "10_staff", basis: "Basic is $25/month; check how many staff it allows on the page." },

  // Added 2026-11-20. Volumes for these categories, used only when a product needs them:
  // background jobs: 30,000 runs a month of about 2 seconds each; SMS: 2,000 US texts a month
  // from one 10-digit number (carrier fees averaged at $0.004 per text, low-volume 10DLC campaign
  // at $1.50/month); search: 10,000 records and 50,000 searches a month; CMS: 3 editors and
  // about 500 entries, with pages cached by your host.
  // Background jobs
  inngest: { monthly: 0, basis: "Executions = runs × (steps + 1): 30,000 runs with no step.run calls is 30,000, inside the free 50,000; 30,000 single-step runs is 60,000, past it, so Pro at $99/month." },
  "trigger-dev": { monthly: 0, basis: "30,000 runs × 2 s × $0.0000338/s (Small 1x) = $2.03 compute + 30,000 × $0.000025 = $0.75 per-run fees, inside the free $5 credit." },
  "upstash-qstash": { monthly: 0.3, basis: "30,000 messages is about 1,000 a day, the Free cap, so retries would push past it; Pay as You Go at $1 per 100K = $0.30." },
  // SMS (US)
  twilio: { monthly: 27.25, basis: "2,000 × $0.0083 = $16.60 + carrier fees ~2,000 × $0.004 = $8 + number $1.15 + 10DLC campaign $1.50 = $27.25; plus one-time brand ($4.50) and campaign vetting ($15) fees." },
  telnyx: { monthly: 18.5, basis: "2,000 × $0.004 = $8 + carrier fees ~2,000 × $0.004 = $8 + number $1 + 10DLC campaign ~$1.50 = $18.50; plus one-time 10DLC registration fees." },
  vonage: { monthly: 27.98, basis: "2,000 × $0.0086 = $17.20 + carrier fees ~2,000 × $0.004 = $8 + long code $1.28 + 10DLC campaign ~$1.50 = $27.98; plus one-time 10DLC registration fees." },
  // Search
  "postgres-full-text": { monthly: 0, basis: "No separate bill; 10,000 records with a GIN index is a few MB in the Postgres you already have." },
  algolia: { monthly: 20, basis: "Grow: 50,000 searches − 10,000 included = 40,000 × $0.50 per 1,000 = $20; 10,000 records fit the 100,000 included. Debounce search-as-you-type or it multiplies." },
  typesense: { monthly: 21.6, basis: "Smallest Cloud configuration at $0.03/hr × 720 hrs = $21.60; searches aren't metered. The first 720 hours are free once per account." },
  meilisearch: { monthly: 20, basis: "Cloud XS: $14.88 instance + $5.28 for the 32 GiB minimum disk = $20/month (US East), unlimited searches." },
  // CMS
  sanity: { monthly: 0, basis: "3 editors and 500 entries fit Free (20 seats, 10k documents); editors get the Administrator role there. Editor roles need Growth: 3 × $15 = $45/month." },
  payload: { monthly: 0, basis: "MIT-licensed, no license or seat fees; it runs in your app and database, whose bills are counted already." },
  contentful: { monthly: 0, basis: "500 entries and 3 editors fit Free (hard caps: 100K API calls/month); the next plan, Lite, is $300/month." },
};
