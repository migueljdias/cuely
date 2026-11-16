// Brand icons from Brandfetch (https://brandfetch.com), fetched 2026-11-16 and saved as 96px tiles
// in public/logos. Each icon belongs to its owner and is shown only to identify the tool; none of
// them is an endorsement or a paid placement. Tools with no icon here fall back to a monogram in
// ToolLogo.

/** Tool slug to the file name (without .png) in public/logos. */
export const TOOL_LOGO: Record<string, string> = {
  "airtable": "airtable",
  "ably": "ably",
  "amazon-route-53": "aws",
  "amazon-s3": "aws",
  "amazon-ses": "aws",
  "appsheet": "appsheet",
  "better-auth": "better-auth",
  "better-stack": "betterstack",
  "claude-api": "claude",
  "clerk": "clerk",
  "cloudflare-dns": "cloudflare",
  "cloudflare-durable-objects": "cloudflare",
  "cloudflare-kv": "cloudflare",
  "cloudflare-r2": "cloudflare",
  "cloudflare-workers": "cloudflare",
  "doppler": "doppler",
  "expo-eas": "expo",
  "firebase": "firebase",
  "gemini-api": "google",
  "glide": "glide",
  "lemon-squeezy": "lemonsqueezy",
  "liveblocks": "liveblocks",
  "neon": "neon",
  "neon-auth": "neon",
  "netlify": "netlify",
  "openai-api": "openai",
  "paddle": "paddle",
  "pgvector": "postgresql",
  "pinecone": "pinecone",
  "plausible": "plausible",
  "posthog": "posthog",
  "postmark": "postmark",
  "pusher": "pusher",
  "redis-cloud": "redis",
  "render": "render",
  "resend": "resend",
  "retool": "retool",
  "revenuecat": "revenuecat",
  "sentry": "sentry",
  "stripe": "stripe",
  "stripe-connect": "stripe",
  "supabase": "supabase",
  "supabase-auth": "supabase",
  "supabase-realtime": "supabase",
  "turbopuffer": "turbopuffer",
  "turso": "turso",
  "upstash-redis": "upstash",
  "vercel": "vercel",
  "vercel-blob": "vercel",
  "vercel-global-config": "vercel",
  "vercel-web-analytics": "vercel",
  "workos-authkit": "workos",
};

export function logoSrc(slug: string): string | null {
  const file = TOOL_LOGO[slug];
  return file ? `/logos/${file}.png` : null;
}
