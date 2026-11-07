import { createHash } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { readApiKey } from "@/accounts/keys";
import { getAccountStore } from "@/accounts/store";
import { PLANS } from "@/plans";
import { getRepository, type Repository } from "@/repo";
import { clientIp, createRateLimiter, type RateLimiter } from "./rate-limit";
import { createCuelyServer } from "./server";

const limit = PLANS.anonymous.perMinute;
const defaultLimiter = createRateLimiter(limit);
const keyLimiters = { free: createRateLimiter(PLANS.free.perMinute), pro: createRateLimiter(PLANS.pro.perMinute) };

export type KeyLookup = (key: string) => Promise<{ keyId: number; plan: "free" | "pro" } | null>;

/** Key lookups are cached for a minute, so a busy agent costs one database read a minute. */
const keyCache = new Map<string, { at: number; value: Awaited<ReturnType<KeyLookup>> }>();
const defaultKeyLookup: KeyLookup = async (key) => {
  const hit = keyCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const store = await getAccountStore();
  const found = store ? await store.resolveKey(key) : null;
  const value = found ? { keyId: found.keyId, plan: found.plan } : null;
  if (keyCache.size > 5000) keyCache.clear();
  keyCache.set(key, { at: Date.now(), value });
  return value;
};

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
  keyLookup?: KeyLookup;
  keyLimiters?: { free: RateLimiter; pro: RateLimiter };
}

/**
 * Stateless Streamable HTTP MCP endpoint: a fresh server and transport per
 * request, JSON responses, no sessions. Works on any serverless host.
 */
export function createMcpHandler(opts: HandlerOptions = {}) {
  const limiter = opts.limiter ?? defaultLimiter;
  const lookupKey = opts.keyLookup ?? defaultKeyLookup;
  const limiters = opts.keyLimiters ?? keyLimiters;

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

    // An API key is optional. With one, limits follow the key's plan. Answers never do.
    const presented = readApiKey(req);
    let bucket = { limiter, key: ip, perMinute: limit, caller: ip };
    if (presented) {
      const found = await lookupKey(presented).catch(() => null);
      if (!found) {
        return Response.json(
          {
            jsonrpc: "2.0",
            error: { code: -32001, message: "Unknown or revoked Cuely API key. Remove the header to use Cuely without one." },
            id: null,
          },
          { status: 401, headers: CORS },
        );
      }
      bucket = { limiter: limiters[found.plan], key: `k${found.keyId}`, perMinute: PLANS[found.plan].perMinute, caller: `k${found.keyId}` };
    }

    const rl = bucket.limiter.check(bucket.key);
    const rlHeaders = {
      "x-ratelimit-limit": String(bucket.perMinute),
      "x-ratelimit-remaining": String(rl.remaining),
      "x-ratelimit-reset": String(rl.resetSeconds),
    };
    if (!rl.ok) {
      return Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32029, message: `Rate limit reached (${bucket.perMinute} requests per minute). Retry in ${rl.resetSeconds}s.` },
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
    const server = createCuelyServer({ repo, callerHash: callerHash(bucket.caller) });
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
