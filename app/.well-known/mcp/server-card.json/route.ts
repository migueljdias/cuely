import { serverCard } from "@/mcp/server-card";

export const dynamic = "force-static";

export function GET() {
  return Response.json(serverCard(), { headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" } });
}
