import type { Category } from "./types";

export const categories: Category[] = [
  {
    slug: "hosting",
    name: "Hosting",
    description: "Where the app's frontend and server code run.",
    howToChoose:
      "Match the runtime to the framework, check whether the free plan allows commercial use, and check what happens at the usage cap (pause or bill).",
    order: 1,
  },
  {
    slug: "database",
    name: "Database",
    description: "The primary datastore for application data.",
    howToChoose:
      "Default to Postgres unless you have a reason not to. Check scale-to-zero, branching for preview environments, and whether free projects pause when idle.",
    order: 2,
  },
  {
    slug: "auth",
    name: "Auth",
    description: "Sign-up, sign-in, sessions, and organizations.",
    howToChoose:
      "For B2B, organizations and enterprise SSO matter more than social logins. Check the price per SSO connection and where user records live.",
    order: 3,
  },
  {
    slug: "payments",
    name: "Payments",
    description: "Checkout, subscriptions, invoices, and tax.",
    howToChoose:
      "Decide first whether you want a merchant of record (they handle sales tax and VAT for a higher fee) or to handle tax yourself on a payment processor.",
    order: 4,
  },
  {
    slug: "email",
    name: "Email",
    description: "Transactional email: invites, receipts, password resets.",
    howToChoose:
      "Deliverability and domain setup (SPF, DKIM, DMARC) matter more than price at small volume. Keep marketing email on a separate stream or subdomain.",
    order: 5,
  },
  {
    slug: "secrets",
    name: "Secrets",
    description: "API keys and environment variables across environments.",
    howToChoose:
      "One source of truth per environment, synced to the host. Check per-seat or per-identity pricing as the team grows.",
    order: 6,
  },
  {
    slug: "dns",
    name: "DNS",
    description: "Domain records for the app and for email authentication.",
    howToChoose:
      "Pick a provider with a good API and fast propagation; the record limits on free plans rarely matter for one app.",
    order: 7,
  },
  {
    slug: "monitoring",
    name: "Monitoring",
    description: "Error tracking, uptime checks, and logs.",
    howToChoose:
      "Error tracking with source maps first, uptime checks second. Check whether the free plan allows more than one user.",
    order: 8,
  },
  {
    slug: "analytics",
    name: "Analytics",
    description: "Product and web analytics.",
    howToChoose:
      "B2B products need per-account (group) analytics, not just pageviews. Cookieless tools can avoid a consent banner for web stats.",
    order: 9,
  },
  {
    slug: "storage",
    name: "Storage",
    description: "File and object storage for uploads and exports.",
    howToChoose: "Watch egress (download) fees; they dominate cost for public files.",
    order: 10,
  },
  {
    slug: "llm",
    name: "AI model API",
    description: "The language model that writes the answers in an AI feature.",
    howToChoose:
      "Tokens are usually the biggest bill. Price your real prompt sizes, send easy requests to a small model, and check whether a free tier uses your data for training.",
    order: 11,
  },
  {
    slug: "vector",
    name: "Vector search",
    description: "Stores embeddings of documents so an AI feature can find the passages to answer from.",
    howToChoose:
      "Start inside your existing Postgres (pgvector) until you have millions of chunks. Filter every query by tenant so one customer never sees another's documents.",
    order: 12,
  },
  {
    slug: "realtime",
    name: "Realtime",
    description: "Live updates between users: presence, shared cursors, collaborative boards and chat.",
    howToChoose:
      "Collaborative documents and boards want a sync engine with rooms; simple live notifications only need pub/sub. Check what the free plan counts: rooms, connections or monthly users.",
    order: 13,
  },
  {
    slug: "mobile_build",
    name: "Mobile builds",
    description: "Building, signing and shipping iOS and Android apps to the stores.",
    howToChoose:
      "A web developer usually wants React Native with Expo. Cloud builds save you a Mac for iOS. Budget for Apple's $99 a year and Google's $25 registration either way.",
    order: 14,
  },
  {
    slug: "internal_tools",
    name: "Internal tool builders",
    description: "No-code and low-code builders for apps your own staff use: forms, tables, inventory, approvals.",
    howToChoose:
      "For a small team, a builder on top of the tools you already have usually beats a custom app nobody maintains. Check the price per user and whether it works on your staff's devices.",
    order: 15,
  },
  {
    slug: "kv",
    name: "Counters and cache",
    description: "A fast key-value store for vote counts, scores, leaderboards, streaks, rate limits and caching hot reads under traffic spikes.",
    howToChoose:
      "Counters and leaderboards need atomic increments and sorted sets, which is Redis. A read-mostly cache can sit in an edge key-value store, but check its per-key write limit and how long a write takes to show everywhere.",
    order: 16,
  },
  {
    slug: "push",
    name: "Push notifications",
    description: "Notifications sent from your backend to the app on people's iPhones and Android phones: reminders, replies, alerts.",
    howToChoose:
      "Every service ends at Apple's APNs and Google's FCM, so the choice is how much sits in between. Pick by how the app is built (Expo, Swift or Firebase), then check what the free plan counts: sends, devices or monthly active users.",
    order: 17,
  },
  {
    slug: "jobs",
    name: "Background jobs",
    description: "Work that runs outside a web request: queues, retries, scheduled tasks, long multi-step workflows and AI calls that outlast a serverless timeout.",
    howToChoose:
      "On serverless hosting, pick a service that calls your existing routes and saves progress between steps, so nothing dies at the function timeout. Check what the free plan counts (runs, steps, messages or compute) and whether retries count too.",
    order: 18,
  },
  {
    slug: "sms",
    name: "SMS and voice",
    description: "Sending and receiving text messages and calls: one-time codes, alerts, reminders and two-way texting.",
    howToChoose:
      "Price per message is only part of the bill: US carriers add a fee to every text, and texting from a normal 10-digit number needs A2P 10DLC registration (brand and campaign fees) before anything is delivered. Compare the per-message rate plus those fees.",
    order: 19,
  },
  {
    slug: "search",
    name: "Search",
    description: "Full-text search over the product's own records: a search bar with typo tolerance, filters and facets.",
    howToChoose:
      "Postgres full-text search covers a search bar over tens of thousands of rows with no new vendor. Move to a search engine when you need typo tolerance, instant results as people type or facet counts, and check whether it bills per search, per record or per server.",
    order: 20,
  },
  {
    slug: "cms",
    name: "CMS",
    description: "Where non-developers write and edit the site's content: blog posts, marketing pages, docs and product copy.",
    howToChoose:
      "If editors only touch a blog or a few pages, a CMS that runs inside your app and database avoids another vendor. A hosted CMS gives editors a polished studio without hosting it. Check seats, roles and API request limits on the free plan.",
    order: 21,
  },
];
