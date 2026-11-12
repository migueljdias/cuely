/**
 * Where each vendor states its compliance facts: the pages the weekly job reads
 * (scripts/collect-compliance.ts) for BAAs, DPAs, EU regions and SOC 2.
 *
 * Only the vendor's own pages, and only pages that load without a browser. Tools
 * from one vendor share pages; the job asks about each tool by name, so a page that
 * covers one product (R2's data location) isn't read as covering another.
 *
 * Left out on purpose:
 * - payments, secrets, DNS and mobile builds: they don't hold the product's user
 *   data, so these facts don't change the pick (see DATA_CATEGORIES).
 * - tools with no vendor behind them (Better Auth, pgvector, cached polling): the
 *   answer is whatever your own host and database say.
 *
 * A tool with no entry, or pages that can't be read, has no compliance facts and is
 * shown as "not stated". Sources are facts about where to look, not opinions.
 */
const VERCEL = ["https://vercel.com/security", "https://vercel.com/docs/security/compliance", "https://vercel.com/legal/dpa"];
const CLOUDFLARE = ["https://www.cloudflare.com/trust-hub/compliance-resources/", "https://www.cloudflare.com/cloudflare-customer-dpa/"];
const SUPABASE = ["https://supabase.com/security", "https://supabase.com/docs/guides/security/hipaa-compliance", "https://supabase.com/docs/guides/platform/regions"];
const AWS = ["https://aws.amazon.com/compliance/hipaa-eligible-services-reference/", "https://aws.amazon.com/compliance/gdpr-center/", "https://aws.amazon.com/compliance/soc-faqs/"];
const NEON = ["https://neon.com/security", "https://neon.com/docs/security/hipaa", "https://neon.com/docs/introduction/regions"];

export const COMPLIANCE_SOURCES: Record<string, string[]> = {
  // Hosting
  vercel: VERCEL,
  "cloudflare-workers": [...CLOUDFLARE, "https://developers.cloudflare.com/workers/configuration/placement/"],
  netlify: ["https://www.netlify.com/security/", "https://www.netlify.com/gdpr-ccpa/"],
  render: ["https://render.com/security", "https://render.com/docs/hipaa-compliance", "https://render.com/docs/regions"],
  // Database
  neon: NEON,
  supabase: SUPABASE,
  turso: ["https://turso.tech/security", "https://docs.turso.tech/cloud/regions"],
  firebase: ["https://firebase.google.com/support/privacy", "https://firebase.google.com/docs/projects/locations"],
  // Auth
  "workos-authkit": ["https://workos.com/security", "https://workos.com/legal/dpa"],
  clerk: ["https://clerk.com/legal/dpa", "https://clerk.com/docs/security/overview"],
  "supabase-auth": SUPABASE,
  "neon-auth": NEON,
  // Email
  resend: ["https://resend.com/security", "https://resend.com/legal/dpa", "https://resend.com/docs/dashboard/domains/regions"],
  postmark: ["https://postmarkapp.com/eu-privacy", "https://postmarkapp.com/support/article/1166-is-postmark-hipaa-compliant"],
  "amazon-ses": AWS,
  // Monitoring
  sentry: ["https://sentry.io/security/", "https://sentry.io/legal/dpa/", "https://docs.sentry.io/organization/data-storage-location/"],
  "better-stack": ["https://betterstack.com/security", "https://betterstack.com/dpa"],
  // Analytics
  posthog: ["https://posthog.com/docs/privacy/hipaa-compliance", "https://posthog.com/docs/privacy/gdpr-compliance", "https://posthog.com/docs/privacy"],
  plausible: ["https://plausible.io/data-policy", "https://plausible.io/dpa"],
  "vercel-web-analytics": VERCEL,
  // Storage
  "cloudflare-r2": [...CLOUDFLARE, "https://developers.cloudflare.com/r2/reference/data-location/"],
  "vercel-blob": VERCEL,
  "amazon-s3": AWS,
  // AI model APIs
  "gemini-api": ["https://ai.google.dev/gemini-api/terms"],
  "claude-api": ["https://www.anthropic.com/legal/data-processing-addendum", "https://privacy.claude.com/en/articles/8114513-business-associate-agreements-baa-for-commercial-customers"],
  "openai-api": ["https://openai.com/security-and-privacy/", "https://platform.openai.com/docs/guides/your-data"],
  // Vector search
  pinecone: ["https://www.pinecone.io/security/", "https://docs.pinecone.io/guides/production/security-overview"],
  turbopuffer: ["https://turbopuffer.com/docs/security", "https://turbopuffer.com/docs/regions"],
  // Realtime
  liveblocks: ["https://liveblocks.io/security"],
  "supabase-realtime": SUPABASE,
  ably: ["https://ably.com/security-and-compliance"],
  pusher: ["https://pusher.com/legal/security/", "https://pusher.com/legal/dpa/"],
  // Internal tool builders
  retool: ["https://retool.com/security", "https://retool.com/dpa"],
  airtable: ["https://www.airtable.com/security", "https://www.airtable.com/company/dpa"],
  glide: ["https://www.glideapps.com/security"],
  // Counters and cache
  "upstash-redis": ["https://upstash.com/docs/common/help/compliance"],
  "cloudflare-durable-objects": [...CLOUDFLARE, "https://developers.cloudflare.com/durable-objects/reference/data-location/"],
  "cloudflare-kv": CLOUDFLARE,
  "vercel-global-config": VERCEL,
  "redis-cloud": ["https://redis.io/trust/", "https://redis.io/legal/redis-dpa/"],
};
