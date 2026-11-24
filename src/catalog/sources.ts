/**
 * Where each tool's health signals are measured (scripts/collect-signals.ts).
 *
 * status: the vendor's own status page, when it serves the Statuspage JSON API
 *         (<status>/api/v2/incidents.json). Tools from one vendor share a page.
 * npm:    the package a builder installs to use the tool; its downloads measure
 *         adoption and its advisories measure security.
 *
 * Neon, Turso, Lemon Squeezy, PostHog and Liveblocks publish status pages in other
 * formats that the collector can't read yet, so they have no status entry.
 *
 * A tool with no entry, or a source that can't be read, has no measured health
 * and keeps its default place. Sources are facts about where to look, not opinions.
 */
export interface ToolSources {
  status?: string;
  npm?: string;
}

const CLOUDFLARE = "https://www.cloudflarestatus.com";
const VERCEL = "https://www.vercel-status.com";
const SUPABASE = "https://status.supabase.com";

export const SOURCES: Record<string, ToolSources> = {
  // Hosting
  vercel: { status: VERCEL, npm: "vercel" },
  "cloudflare-workers": { status: CLOUDFLARE, npm: "wrangler" },
  netlify: { status: "https://www.netlifystatus.com", npm: "netlify-cli" },
  render: { status: "https://status.render.com" },
  // Database
  neon: { npm: "@neondatabase/serverless" },
  supabase: { status: SUPABASE, npm: "@supabase/supabase-js" },
  turso: { npm: "@libsql/client" },
  firebase: { npm: "firebase" },
  // Auth
  "workos-authkit": { status: "https://status.workos.com", npm: "@workos-inc/authkit-nextjs" },
  clerk: { status: "https://status.clerk.com", npm: "@clerk/nextjs" },
  "better-auth": { npm: "better-auth" },
  "supabase-auth": { status: SUPABASE, npm: "@supabase/auth-js" },
  // Payments
  stripe: { npm: "stripe" },
  "stripe-connect": { npm: "@stripe/connect-js" },
  paddle: { status: "https://paddlestatus.com", npm: "@paddle/paddle-js" },
  "lemon-squeezy": { npm: "@lemonsqueezy/lemonsqueezy.js" },
  revenuecat: { status: "https://status.revenuecat.com", npm: "react-native-purchases" },
  // Email
  resend: { status: "https://resend-status.com", npm: "resend" },
  postmark: { npm: "postmark" },
  "amazon-ses": { npm: "@aws-sdk/client-sesv2" },
  // Secrets
  infisical: { status: "https://status.infisical.com", npm: "@infisical/sdk" },
  doppler: { status: "https://www.dopplerstatus.com" },
  // DNS
  "cloudflare-dns": { status: CLOUDFLARE },
  // Monitoring
  sentry: { status: "https://status.sentry.io", npm: "@sentry/node" },
  "better-stack": { npm: "@logtail/node" },
  // Analytics
  posthog: { npm: "posthog-js" },
  "vercel-web-analytics": { status: VERCEL, npm: "@vercel/analytics" },
  // Storage
  "cloudflare-r2": { status: CLOUDFLARE },
  "vercel-blob": { status: VERCEL, npm: "@vercel/blob" },
  "amazon-s3": { npm: "@aws-sdk/client-s3" },
  // AI model APIs
  "claude-api": { status: "https://status.claude.com", npm: "@anthropic-ai/sdk" },
  "openai-api": { status: "https://status.openai.com", npm: "openai" },
  "gemini-api": { npm: "@google/genai" },
  // Vector search
  pgvector: { npm: "pgvector" },
  pinecone: { status: "https://status.pinecone.io", npm: "@pinecone-database/pinecone" },
  turbopuffer: { npm: "@turbopuffer/turbopuffer" },
  // Realtime
  liveblocks: { npm: "@liveblocks/client" },
  "supabase-realtime": { status: SUPABASE, npm: "@supabase/realtime-js" },
  ably: { npm: "ably" },
  pusher: { status: "https://status.pusher.com", npm: "pusher-js" },
  // Mobile builds
  "expo-eas": { status: "https://status.expo.dev", npm: "eas-cli" },
  // Push notifications
  "expo-push": { status: "https://status.expo.dev", npm: "expo-notifications" },
  "firebase-cloud-messaging": { npm: "@react-native-firebase/messaging" },
  onesignal: { npm: "react-native-onesignal" },
  // Internal tool builders
  retool: { status: "https://status.retool.com" },
  airtable: { status: "https://status.airtable.com" },
  // Counters and cache
  "upstash-redis": { status: "https://status.upstash.com", npm: "@upstash/redis" },
  "cloudflare-durable-objects": { status: CLOUDFLARE },
  "cloudflare-kv": { status: CLOUDFLARE },
  "vercel-global-config": { status: VERCEL, npm: "@vercel/edge-config" },
  // Background jobs, SMS, search, CMS and store platforms (added 2026-11-20). Status pages are
  // listed only where <status>/api/v2/incidents.json returned Statuspage JSON on 2026-11-20.
  // Trigger.dev, Algolia and Meilisearch publish status pages in other formats; Typesense's
  // status host didn't resolve; Vonage's answered only through a proxy the daily job doesn't use.
  inngest: { status: "https://status.inngest.com", npm: "inngest" },
  "trigger-dev": { npm: "@trigger.dev/sdk" },
  "upstash-qstash": { status: "https://status.upstash.com", npm: "@upstash/qstash" },
  twilio: { status: "https://status.twilio.com", npm: "twilio" },
  telnyx: { status: "https://status.telnyx.com", npm: "telnyx" },
  vonage: { npm: "@vonage/server-sdk" },
  algolia: { npm: "algoliasearch" },
  typesense: { npm: "typesense" },
  meilisearch: { npm: "meilisearch" },
  sanity: { status: "https://www.sanity-status.com", npm: "@sanity/client" },
  payload: { npm: "payload" },
  contentful: { status: "https://www.contentfulstatus.com", npm: "contentful" },
  shopify: { status: "https://www.shopifystatus.com", npm: "@shopify/shopify-api" },
  medusa: { status: "https://status.medusajs.com", npm: "@medusajs/medusa" },
};
