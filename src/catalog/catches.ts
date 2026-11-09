/**
 * Catches: the facts that change a plan for a whole kind of product, not for one
 * tool. Each one names the page it was read from and the date. They are shown at
 * the top of an answer when the product's profile triggers them (src/engine/profile.ts).
 */
export interface Catch {
  id: string;
  /** Profile flag that triggers it. */
  when: "mobile_paid" | "mobile" | "mobile_social_login" | "marketplace" | "in_person" | "ai" | "rag" | "usage_billing" | "internal" | "internal_workspace" | "realtime" | "game";
  text: string;
  source: string;
  verifiedOn: string;
}

const V = "2026-11-07";

export const CATCHES: Catch[] = [
  {
    id: "ios-in-app-purchase",
    when: "mobile_paid",
    text: "Apple requires in-app purchase to unlock subscriptions or features inside an iOS app (App Review Guideline 3.1.1), so Stripe checkout inside the app gets rejected. US storefront apps may also add a button or link to buy on the web (3.1.1(a)).",
    source: "https://developer.apple.com/app-store/review/guidelines/",
    verifiedOn: V,
  },
  {
    id: "store-fees",
    when: "mobile_paid",
    text: "The stores take a cut of in-app revenue: Apple 15% under the Small Business Program (up to $1M in proceeds a year), Google Play 10% + 5% billing fee on auto-renewing subscriptions for the first $1M in the US, EEA and UK.",
    source: "https://support.google.com/googleplay/android-developer/answer/112622",
    verifiedOn: V,
  },
  {
    id: "store-accounts",
    when: "mobile",
    text: "Store accounts cost $99 a year for the Apple Developer Program and $25 once for Google Play.",
    source: "https://developer.apple.com/programs/",
    verifiedOn: V,
  },
  {
    id: "sign-in-with-apple",
    when: "mobile_social_login",
    text: "If the iOS app offers Google or another social login, it must also offer an equivalent private login option such as Sign in with Apple (Guideline 4.8).",
    source: "https://developer.apple.com/app-store/review/guidelines/",
    verifiedOn: V,
  },
  {
    id: "connect-pricing",
    when: "marketplace",
    text: "Use Stripe Connect to split each payment, keep your cut and pay providers out. If Stripe bills providers' fees directly there are no extra account or payout fees; if you handle pricing it's $2 per monthly active provider plus 0.25% + 25¢ per payout.",
    source: "https://stripe.com/connect/pricing",
    verifiedOn: V,
  },
  {
    id: "background-checks",
    when: "in_person",
    text: "Connect verifies providers' identity, but background checks for people who go into homes are separate: Checkr Basic starts at $29.99 per report plus pass-through fees.",
    source: "https://checkr.com/pricing",
    verifiedOn: V,
  },
  {
    id: "token-cost",
    when: "ai",
    text: "Tokens are the bill that grows with users. At 50 questions per user a month, a mid-size model costs about $488 to $650 a month at 1,000 users and a small one (Haiku 5.5, gpt-6-luna) about $33. Send easy questions to the small model and cap usage per account.",
    source: "https://platform.claude.com/docs/en/about-claude/pricing",
    verifiedOn: V,
  },
  {
    id: "rag-ingest",
    when: "rag",
    text: "Turning PDFs into text is a separate step: LlamaParse basic parsing is as low as 1 credit a page, with 10,000 free credits a month, then $1.50 per 1,000. Embeddings are cheap: voyage-4 is $0.06 per million tokens and the first 200M are free. Filter every vector query by customer.",
    source: "https://www.llamaindex.ai/pricing",
    verifiedOn: V,
  },
  {
    id: "meter-usage",
    when: "usage_billing",
    text: "Record usage in your own database and send it to Stripe's Meters API, which is included in Billing pricing (0.7% of billing volume) up to 100M events a month.",
    source: "https://stripe.com/billing/pricing",
    verifiedOn: V,
  },
  {
    id: "internal-dont-build",
    when: "internal",
    text: "For a small staff tool, a builder usually beats a custom app: someone has to host, fix and update custom code. Build only if the builders can't do the logic you need.",
    source: "https://retool.com/pricing",
    verifiedOn: V,
  },
  {
    id: "appsheet-in-workspace",
    when: "internal_workspace",
    text: "AppSheet Core is included in most paid Google Workspace plans and reads your Sheets directly; check your plan in the admin console. You can test with up to 10 users free.",
    source: "https://about.appsheet.com/pricing/",
    verifiedOn: V,
  },
  {
    id: "realtime-free-limits",
    when: "realtime",
    text: "Live features have their own limits: Liveblocks Free allows 500 monthly active rooms and 10 people per room at once; bigger sessions need Pro ($25/month billed annually).",
    source: "https://liveblocks.io/pricing",
    verifiedOn: V,
  },
  {
    id: "game-free-plans-stop",
    when: "game",
    text: "Free plans stop hard on a viral day: Cloudflare Workers Free returns error 1027 after 100,000 requests a day, and on Vercel Hobby going over the included 1M CDN requests a month means waiting 30 days. Move to Workers Paid ($5/month) or Vercel Pro ($20/month) before you share the game.",
    source: "https://developers.cloudflare.com/workers/platform/limits/",
    verifiedOn: "2026-11-09",
  },
  {
    id: "game-count-in-redis",
    when: "game",
    text: "Count votes in Redis, not with a database count on every view: Upstash runs up to 10,000 commands a second on every plan, with 500K a month free and $0.20 per 100K after, so set its budget cap. Cloudflare KV can't count votes: it allows 1 write per second to the same key.",
    source: "https://upstash.com/pricing/redis",
    verifiedOn: "2026-11-09",
  },
  {
    id: "game-poll-dont-push",
    when: "game",
    text: "Show live percentages by polling one cached results endpoint every few seconds instead of a realtime service: Supabase Realtime Free allows 200 concurrent connections, Ably Free 500 monthly users and Pusher's Sandbox 100 connections, and a viral day passes those in minutes.",
    source: "https://supabase.com/pricing",
    verifiedOn: "2026-11-09",
  },
];
