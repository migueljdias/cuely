import { METADATA_CORS, protectedResourceMetadata } from "@/mcp/oauth";

// RFC 9728 metadata for https://cuely.dev/api/mcp: tells MCP clients to sign in with Clerk.
export function GET() {
  return Response.json(protectedResourceMetadata(), {
    headers: { ...METADATA_CORS, "cache-control": "public, max-age=3600" },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: METADATA_CORS });
}
