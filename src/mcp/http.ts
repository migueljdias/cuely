import { createHash } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getRepository, type Repository } from "@/repo";
import { clientIp, createRateLimiter, type RateLimiter } from "./rate-limit";
import { createCuelyServer } from "./server";

const limit = Number(process.env.CUELY_RATE_LIMIT_PER_MINUTE) || 60;
const defaultLimiter = createRateLimiter(limit);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, accept, authorization, mcp-session-id, mcp-protocol-version, last-event-id",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
};

function withHeaders(res: Response, extra: Record<string, string>): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Daily-salted, truncated hash: counts unique callers per day without storing IPs. */
export function callerHash(ip: string, day = new Date().toISOString().slice(0, 10)): string {
  const salt = process.env.CUELY_HASH_SALT ?? "cuely";
  return createHash("sha256").update(`${salt}:${day}:${ip}`).digest("hex").slice(0, 16);
}

export interface HandlerOptions {
  repo?: Repository;
  limiter?: RateLimiter;
}

/**
 * Stateless Streamable HTTP MCP endpoint: a fresh server and transport per
 * request, JSON responses, no sessions. Works on any serverless host.
 */
export function createMcpHandler(opts: HandlerOptions = {}) {
  const limiter = opts.limiter ?? defaultLimiter;

  return async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (req.method === "GET" && !(req.headers.get("accept") ?? "").includes("text/event-stream")) {
      return Response.json(
        {
          name: "cuely",
          transport: "streamable-http",
          endpoint: new URL(req.url).pathname,
          tools: ["recommend_stack", "get_recipe", "compare_tools", "list_categories"],
          docs: "https://cuely.dev",
        },
        { headers: CORS },
      );
    }

    const ip = clientIp(req);
    const rl = limiter.check(ip);
    const rlHeaders = {
      "x-ratelimit-limit": String(limit),
      "x-ratelimit-remaining": String(rl.remaining),
      "x-ratelimit-reset": String(rl.resetSeconds),
    };
    if (!rl.ok) {
      return Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32029, message: `Rate limit reached (${limit} requests per minute). Retry in ${rl.resetSeconds}s.` },
          id: null,
        },
        { status: 429, headers: { ...CORS, ...rlHeaders, "retry-after": String(rl.resetSeconds) } },
      );
    }

    if (req.method !== "POST") {
      // Stateless server: no standalone SSE stream and no sessions to delete.
      return Response.json(
        { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Send JSON-RPC over POST." }, id: null },
        { status: 405, headers: { ...CORS, allow: "POST, OPTIONS" } },
      );
    }

    const repo = opts.repo ?? (await getRepository());
    const server = createCuelyServer({ repo, callerHash: callerHash(ip) });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      const res = await transport.handleRequest(req);
      return withHeaders(res, { ...CORS, ...rlHeaders });
    } catch (err) {
      console.error("mcp error", err);
      return Response.json(
        { jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null },
        { status: 500, headers: CORS },
      );
    } finally {
      // JSON response mode has fully produced the body by now.
      void transport.close().catch(() => {});
      void server.close().catch(() => {});
    }
  };
}
