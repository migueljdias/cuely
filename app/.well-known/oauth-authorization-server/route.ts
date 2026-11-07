import { clerkIssuer, METADATA_CORS } from "@/mcp/oauth";

export const revalidate = 3600;

/**
 * For older MCP clients that look for OAuth server metadata on the MCP host itself:
 * Clerk's own document, passed through unchanged.
 */
export async function GET() {
  const issuer = clerkIssuer();
  if (!issuer) return Response.json({ error: "not_configured" }, { status: 404, headers: METADATA_CORS });
  const res = await fetch(`${issuer}/.well-known/oauth-authorization-server`, { next: { revalidate: 3600 } });
  if (!res.ok) return Response.json({ error: "upstream_unavailable" }, { status: 502, headers: METADATA_CORS });
  return Response.json(await res.json(), { headers: { ...METADATA_CORS, "cache-control": "public, max-age=3600" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: METADATA_CORS });
}
