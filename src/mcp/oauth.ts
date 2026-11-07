import { createClerkClient } from "@clerk/backend";
import { SITE_URL } from "@/site";

/**
 * MCP OAuth through Clerk. Claude's and ChatGPT's custom connectors (and Cursor, Claude Code)
 * follow the 401 to the protected-resource metadata below, sign the person in with Clerk,
 * and come back with an OAuth access token whose audience is this MCP URL.
 */
export const MCP_RESOURCE_URL = `${SITE_URL}/api/mcp`;
export const RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource/api/mcp";
export const RESOURCE_METADATA_URL = `${SITE_URL}${RESOURCE_METADATA_PATH}`;
export const OAUTH_SCOPES = ["profile", "email"];

/** Clerk's Frontend API (the OAuth issuer), from CLERK_ISSUER_URL or decoded from the publishable key. */
export function clerkIssuer(env: Record<string, string | undefined> = process.env): string | null {
  if (env.CLERK_ISSUER_URL) return env.CLERK_ISSUER_URL.replace(/\/$/, "");
  const pk = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? env.CLERK_PUBLISHABLE_KEY;
  const m = pk?.match(/^pk_(?:live|test)_(.+)$/);
  if (!m) return null;
  try {
    const host = Buffer.from(m[1], "base64").toString("utf8").replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}

/** RFC 9728 protected resource metadata for the MCP endpoint. */
export function protectedResourceMetadata() {
  const issuer = clerkIssuer();
  return {
    resource: MCP_RESOURCE_URL,
    authorization_servers: issuer ? [issuer] : [],
    scopes_supported: OAUTH_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Cuely",
    resource_documentation: SITE_URL,
  };
}

export const METADATA_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
};

let clerk: ReturnType<typeof createClerkClient> | null = null;
function client() {
  if (clerk) return clerk;
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY;
  if (!secretKey || !publishableKey) return null;
  clerk = createClerkClient({ secretKey, publishableKey });
  return clerk;
}

/**
 * Verifies a Clerk OAuth access token for this MCP server: signature, expiry, and that its
 * audience is exactly MCP_RESOURCE_URL. Returns the Clerk user ID, or null.
 * Throws only when Clerk can't be reached or isn't configured.
 */
export async function verifyOAuthToken(req: Request): Promise<string | null> {
  const c = client();
  if (!c) throw new Error("Clerk is not configured.");
  const state = await c.authenticateRequest(req, { acceptsToken: "oauth_token", audience: MCP_RESOURCE_URL });
  if (!state.isAuthenticated) return null;
  const auth = state.toAuth() as { userId?: string | null; subject?: string | null };
  return auth.userId ?? auth.subject ?? null;
}
