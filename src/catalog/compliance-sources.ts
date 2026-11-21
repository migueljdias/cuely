/**
 * Where each vendor states its compliance facts: the pages the daily job reads
 * (scripts/collect-compliance.ts) for BAAs, DPAs, EU regions and SOC 2.
 *
 * Only the vendor's own pages, and only pages that load without a browser. Tools
 * from one vendor share pages; the job asks about each tool by name, so a page that
 * covers one product (R2's data location) isn't read as covering another.
 *
 * Left out on purpose:
 * - payments, secrets, DNS, mobile builds and push: they don't hold the product's user
 *   data (push services hold device tokens and the messages you send), so these facts don't change the pick (see DATA_CATEGORIES).
 * - tools with no vendor behind them (Better Auth, pgvector, cached polling): the
 *   answer is whatever your own host and database say.
 *
 * - Vonage: no page of its own on these topics for its APIs turned up (checked 2026-11-20).
 * - Turso, the Gemini API and Pusher Channels: no page of theirs on these topics
 *   loads without a browser (checked 2026-11-12). Google Cloud's HIPAA page covers
 *   Vertex AI, not the Gemini API, so it isn't used.
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
  firebase: ["https://firebase.google.com/support/privacy", "https://firebase.google.com/docs/projects/locations"],
  // Auth
  "workos-authkit": ["https://workos.com/security", "https://workos.com/legal/dpa"],
  clerk: ["https://clerk.com/legal/dpa"],
  "supabase-auth": SUPABASE,
  "neon-auth": NEON,
  // Email
  resend: ["https://resend.com/security", "https://resend.com/legal/dpa", "https://resend.com/docs/dashboard/domains/regions"],
  postmark: ["https://postmarkapp.com/eu-privacy", "https://postmarkapp.com/support/article/1041-is-postmark-hipaa-compliant"],
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
  "claude-api": ["https://www.anthropic.com/legal/data-processing-addendum", "https://privacy.claude.com/en/articles/8114513-business-associate-agreements-baa-for-commercial-customers"],
  "openai-api": ["https://platform.openai.com/docs/guides/your-data"],
  // Vector search
  pinecone: ["https://www.pinecone.io/security/", "https://docs.pinecone.io/guides/production/security-overview"],
  turbopuffer: ["https://turbopuffer.com/docs/security", "https://turbopuffer.com/docs/regions"],
  // Realtime
  liveblocks: ["https://liveblocks.io/security"],
  "supabase-realtime": SUPABASE,
  ably: ["https://ably.com/security-and-compliance"],
  // Internal tool builders
  retool: ["https://retool.com/security", "https://docs.retool.com/legal/dpa"],
  airtable: ["https://www.airtable.com/security", "https://www.airtable.com/company/dpa"],
  glide: ["https://www.glideapps.com/security"],
  // Counters and cache
  "upstash-redis": ["https://upstash.com/docs/common/help/compliance"],
  "cloudflare-durable-objects": [...CLOUDFLARE, "https://developers.cloudflare.com/durable-objects/reference/data-location/"],
  "cloudflare-kv": CLOUDFLARE,
  "vercel-global-config": VERCEL,
  "redis-cloud": ["https://redis.io/trust/"],
  // Background jobs, SMS and search (added 2026-11-20; each page checked to load without a browser)
  inngest: ["https://www.inngest.com/security", "https://www.inngest.com/pricing"],
  "trigger-dev": ["https://trigger.dev/security"],
  "upstash-qstash": ["https://upstash.com/docs/common/help/compliance"],
  twilio: ["https://www.twilio.com/en-us/hipaa"],
  telnyx: ["https://telnyx.com/data-privacy"],
  algolia: ["https://www.algolia.com/policies/security-measures", "https://www.algolia.com/policies/data-processing-addendum"],
  typesense: ["https://cloud.typesense.org/security", "https://cloud.typesense.org/legal/dpa"],
  meilisearch: ["https://www.meilisearch.com/eu", "https://www.meilisearch.com/docs/capabilities/platform/infrastructure/regions"],
};
