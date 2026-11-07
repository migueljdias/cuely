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
];
