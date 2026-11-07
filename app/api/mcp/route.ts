import { createMcpHandler } from "@/mcp/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const handler = createMcpHandler();

export { handler as GET, handler as POST, handler as DELETE, handler as OPTIONS };
