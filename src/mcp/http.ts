import { createHash } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { looksLikeApiKey, readApiKey } from "@/accounts/keys";
import { getAccountStore, type UsageCount } from "@/accounts/store";
import { PLANS, type PlanId } from "@/plans";
import { getRepository, type Repository } from "@/repo";
import { APP_URL } from "@/site";
import { clientIp, createRateLimiter, type RateLimiter } from "./rate-limit";
import { OAUTH_SCOPES, RESOURCE_METADATA_URL, verifyOAuthToken } from "./oauth";
import { createCuelyServer } from "./server";

export const KEY_URL = `${APP_URL}/account`;
export const UPGRADE_URL = `${APP_URL}/account`;

export type KeyOwner = { keyId: number; userId: string; plan: PlanId };
/** Resolves a presented key. null means unknown or revoked; a throw means the lookup itself failed. */
export type KeyLookup = (key: string) => Promise<KeyOwner | null>;
/** Counts one request (and its tool calls) against an account and returns the running totals. */
export type UsageCounter = (userId: string, toolCalls: number) => Promise<UsageCount>;

/** Key lookups are cached for a minute, so a busy agent costs one key read a minute per instance. */
const keyCache = new Map<string, { at: number; value: KeyOwner | null }>();
const defaultKeyLookup: KeyLookup = async (key) => {
  const hit = keyCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const store = await getAccountStore();
  if (!store) throw new Error("No account database configured.");
  const found = await store.resolveKey(key);
  const value = found ? { keyId: found.keyId, userId: found.userId, plan: found.plan } : null;
  if (keyCache.size > 5000) keyCache.clear();
  keyCache.set(key, { at: Date.now(), value });
  return value;
};

/** Verifies a Clerk OAuth token (from the Claude and ChatGPT app sign-ins and other OAuth clients). */
export type OAuthLookup = (req: Request, token: string) => Promise<KeyOwner | null>;

/** OAuth tokens are cached by hash for a minute too, with the owner's plan. */
const tokenCache = new Map<string, { at: number; value: KeyOwner | null }>();
const defaultOAuthLookup: OAuthLookup = async (req, token) => {
  const h = createHash("sha256").update(token).digest("hex");
  const hit = tokenCache.get(h);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const userId = await verifyOAuthToken(req);
  let value: KeyOwner | null = null;
  if (userId) {
    const store = await getAccountStore();
    if (!store) throw new Error("No account database configured.");
    // Signing in through a connector creates the Free account if it doesn't exist yet.
    const account = await store.ensure(userId, null);
    value = { keyId: 0, userId, plan: account.plan };
  }
  if (tokenCache.size > 5000) tokenCache.clear();
  tokenCache.set(h, { at: Date.now(), value });
  return value;
};

const defaultUsageCounter: UsageCounter = async (userId, toolCalls) => {
  const store = await getAccountStore();
  if (!store) throw new Error("No account database configured.");
  return store.countRequest(userId, toolCalls);
};

/** In-memory counter with the same shape as the database one. Used in tests and local development. */
export function memoryUsageCounter(now: () => number = Date.now): UsageCounter {
  const rows = new Map<string, { day: string; calls: number; minuteStart: number; minuteCalls: number }>();
  return async (userId, toolCalls) => {
    const t = now();
    const day = new Date(t).toISOString().slice(0, 10);
    const minuteStart = Math.floor(t / 60_000) * 60_000;
    let r = rows.get(userId);
    if (!r || r.day !== day) r = { day, calls: 0, minuteStart, minuteCalls: 0 };
    r.calls += toolCalls;
    r.minuteCalls = r.minuteStart === minuteStart ? r.minuteCalls + 1 : 1;
    r.minuteStart = minuteStart;
    rows.set(userId, r);
    return { calls: r.calls, minuteCalls: r.minuteCalls, minuteStart };
  };
}

/**
 * With no account database outside production (local `next dev`, previews without DATABASE_URL),
 * the MCP stays open so the site can be developed. Production without a database refuses every call.
 */
function devOpen(): boolean {
  return !process.env.DATABASE_URL && process.env.VERCEL_ENV !== "production";
}
const devCounter = memoryUsageCounter();

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers":
    "content-type, accept, authorization, x-api-key, mcp-session-id, mcp-protocol-version, last-event-id",
  "access-control-expose-headers":
    "mcp-session-id, mcp-protocol-version, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, retry-after",
};

function withHeaders(res: Response, extra: Record<string, string>): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Daily-salted, truncated hash: counts unique callers per day without tracking them over time. */
export function callerHash(caller: string, day = new Date().toISOString().slice(0, 10)): string {
  const salt = process.env.CUELY_HASH_SALT ?? "cuely";
  return createHash("sha256").update(`${salt}:${day}:${caller}`).digest("hex").slice(0, 16);
}

/** Next 00:00 UTC after t. */
export function nextUtcMidnight(t: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

function inWords(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** The JSON-RPC messages in a request body: tool calls count toward the daily limit, the rest don't. */
function readBody(text: string): { toolCalls: number; id: string | number | null } {
  try {
    const parsed = JSON.parse(text);
    const msgs: any[] = Array.isArray(parsed) ? parsed : [parsed];
    const toolCalls = msgs.filter((m) => m && m.method === "tools/call").length;
    const id = !Array.isArray(parsed) && (typeof parsed?.id === "string" || typeof parsed?.id === "number") ? parsed.id : null;
    return { toolCalls, id };
  } catch {
    return { toolCalls: 0, id: null };
  }
}

export interface HandlerOptions {
  repo?: Repository;
  keyLookup?: KeyLookup;
  oauthLookup?: OAuthLookup;
  countUsage?: UsageCounter;
  /** Limits requests without a valid key, per IP, before any database work. */
  guard?: RateLimiter;
  now?: () => number;
}

/**
 * Stateless Streamable HTTP MCP endpoint: a fresh server and transport per
 * request, JSON responses, no sessions. Works on any serverless host.
 *
 * Every POST needs an account: either a Cuely API key (Authorization: Bearer cuely_..., or
 * x-api-key) or a Clerk OAuth access token from the MCP sign-in that Claude's connector and other
 * OAuth clients run. Limits are per account: requests per minute, tool calls per UTC day.
 */
export function createMcpHandler(opts: HandlerOptions = {}) {
  const injected = Boolean(opts.keyLookup || opts.oauthLookup);
  const lookupKey = opts.keyLookup ?? defaultKeyLookup;
  const lookupToken = opts.oauthLookup ?? defaultOAuthLookup;
  const countUsage = opts.countUsage ?? defaultUsageCounter;
  const guard = opts.guard ?? createRateLimiter(30);
  const now = opts.now ?? Date.now;
  // Once an account is over a limit, this instance answers 429 without the database until it resets.
  const blocked = new Map<string, { until: number; plan: PlanId; kind: "minute" | "day" }>();

  const error = (status: number, code: number, message: string, id: string | number | null, headers: Record<string, string> = {}, data?: object) =>
    Response.json({ jsonrpc: "2.0", error: { code, message, ...(data ? { data } : {}) }, id }, { status, headers: { ...CORS, ...headers } });

  const challenge = (invalidToken = false) =>
    `Bearer ${invalidToken ? 'error="invalid_token", ' : ""}resource_metadata="${RESOURCE_METADATA_URL}", scope="${OAUTH_SCOPES.join(" ")}"`;

  const unauthorized = (message: string, id: string | number | null, invalidToken = false) =>
    error(401, -32001, message, id, { "www-authenticate": challenge(invalidToken) }, { sign_in: RESOURCE_METADATA_URL, get_a_key: KEY_URL });

  return async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (req.method === "GET" && !(req.headers.get("accept") ?? "").includes("text/event-stream")) {
      return Response.json(
        {
          name: "cuely",
          transport: "streamable-http",
          endpoint: new URL(req.url).pathname,
          tools: ["start_project", "recommend_stack", "check_project", "get_recipe", "compare_tools", "list_categories"],
          auth: {
            oauth: RESOURCE_METADATA_URL,
            api_key: `Send "Authorization: Bearer cuely_..." with a key from ${KEY_URL}`,
          },
          limits: {
            free: { tool_calls_per_day: PLANS.free.perDay, requests_per_minute: PLANS.free.perMinute },
            pro: { tool_calls_per_day: PLANS.pro.perDay, requests_per_minute: PLANS.pro.perMinute },
          },
          docs: "https://cuely.dev",
        },
        // Without a credential the info still comes back, as a 401 with the OAuth challenge, so
        // clients and checkers that probe with GET find the sign-in too.
        !req.headers.get("authorization") && (injected || !devOpen())
          ? { status: 401, headers: { ...CORS, "www-authenticate": challenge() } }
          : { headers: CORS },
      );
    }

    if (req.method !== "POST") {
      // Stateless server: no standalone SSE stream and no sessions to delete.
      return Response.json(
        { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Send JSON-RPC over POST." }, id: null },
        { status: 405, headers: { ...CORS, allow: "POST, OPTIONS" } },
      );
    }

    const bodyText = await req.clone().text();
    const { toolCalls, id } = readBody(bodyText);
    const ip = clientIp(req);
    const t = now();

    // Who is calling. Requests without a valid key are capped per IP after the lookup; the Vercel firewall caps per IP before it.
    let owner: KeyOwner | null = null;
    let count: UsageCounter = countUsage;
    const presented = readApiKey(req);
    if (!injected && devOpen()) {
      owner = { keyId: 0, userId: `dev:${ip}`, plan: "free" };
      count = devCounter;
    } else {
      const refuse = (message: string, invalidToken = false) => {
        const g = guard.check(ip, t);
        if (!g.ok) return error(429, -32029, `Too many requests without a valid key. Retry in ${g.resetSeconds}s.`, id, { "retry-after": String(g.resetSeconds) });
        return unauthorized(message, id, invalidToken);
      };
      if (!presented) {
        return refuse(
          `Cuely needs a free account. Sign in when your AI tool asks (the Claude and ChatGPT apps do this for you), or get an API key at ${KEY_URL} and send it as "Authorization: Bearer cuely_...".`,
        );
      }
      const isKey = presented.startsWith("cuely_");
      const isJwt = /^[\w-]+\.[\w-]+\.[\w-]+$/.test(presented);
      if (isKey && !injected && !looksLikeApiKey(presented)) {
        return refuse(`That isn't a valid Cuely API key. Get a free one at ${KEY_URL}.`);
      }
      if (!isKey && !isJwt) return refuse(`Cuely couldn't read that credential. Sign in again, or use an API key from ${KEY_URL}.`);
      try {
        owner = isKey ? await lookupKey(presented) : await lookupToken(req, presented);
      } catch (err) {
        console.error("credential check failed", err);
        return error(503, -32002, "Cuely couldn't check your sign-in just now. Retry in a few seconds.", id, { "retry-after": "5" });
      }
      if (!owner) {
        return refuse(
          isKey
            ? `Unknown or revoked Cuely API key. Make a new one at ${KEY_URL}.`
            : "Your Cuely sign-in has expired or isn't for this server. Sign in again.",
          !isKey,
        );
      }
    }

    const plan = PLANS[owner.plan];
    const dayReset = nextUtcMidnight(t);
    const dayResetSeconds = Math.max(1, Math.ceil((dayReset - t) / 1000));
    const resetAt = new Date(dayReset).toISOString();
    const upgrade = owner.plan === "free" ? ` Pro raises this to ${PLANS.pro.perDay.toLocaleString("en-US")} a day for ${PLANS.pro.priceLabel}: ${UPGRADE_URL}` : "";

    const dayLimited = (headers: Record<string, string>) =>
      error(
        429,
        -32029,
        `Daily limit reached: ${plan.perDay.toLocaleString("en-US")} tool calls a day on the ${plan.name} plan. It resets at 00:00 UTC (${resetAt}), in ${inWords(dayResetSeconds)}.${upgrade}`,
        id,
        { ...headers, "retry-after": String(dayResetSeconds) },
        { limit: "day", plan: owner.plan, reset_at: resetAt, retry_after_seconds: dayResetSeconds, ...(upgrade ? { upgrade_url: UPGRADE_URL } : {}) },
      );
    const minuteLimited = (seconds: number, headers: Record<string, string>) =>
      error(
        429,
        -32029,
        `Rate limit reached: ${plan.perMinute} requests a minute on the ${plan.name} plan. Retry in ${seconds}s.${owner!.plan === "free" ? ` Pro allows ${PLANS.pro.perMinute} a minute: ${UPGRADE_URL}` : ""}`,
        id,
        { ...headers, "retry-after": String(seconds) },
        { limit: "minute", plan: owner!.plan, retry_after_seconds: seconds },
      );

    const blockKey = owner.userId;
    const block = blocked.get(blockKey);
    if (block && block.until > t && block.plan === owner.plan) {
      if (block.kind === "minute") return minuteLimited(Math.max(1, Math.ceil((block.until - t) / 1000)), {});
      if (toolCalls > 0) return dayLimited({ "x-ratelimit-limit": String(plan.perDay), "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(dayResetSeconds) });
    } else if (block) {
      blocked.delete(blockKey);
    }

    let usage: UsageCount | null = null;
    try {
      usage = await count(owner.userId, toolCalls);
    } catch (err) {
      // Limits protect the service; a counting hiccup shouldn't take answers down with it.
      console.error("usage count failed", err);
    }

    const rlHeaders: Record<string, string> = {
      "x-ratelimit-limit": String(plan.perDay),
      "x-ratelimit-remaining": String(usage ? Math.max(0, plan.perDay - usage.calls) : plan.perDay),
      "x-ratelimit-reset": String(dayResetSeconds),
    };

    if (usage && usage.minuteCalls > plan.perMinute) {
      const until = usage.minuteStart + 60_000;
      blocked.set(blockKey, { until, plan: owner.plan, kind: "minute" });
      if (blocked.size > 5000) blocked.clear();
      return minuteLimited(Math.max(1, Math.ceil((until - t) / 1000)), rlHeaders);
    }
    if (usage && toolCalls > 0 && usage.calls > plan.perDay) {
      blocked.set(blockKey, { until: dayReset, plan: owner.plan, kind: "day" });
      if (blocked.size > 5000) blocked.clear();
      return dayLimited({ ...rlHeaders, "x-ratelimit-remaining": "0" });
    }

    const repo = opts.repo ?? (await getRepository());
    const server = createCuelyServer({ repo, callerHash: callerHash(`u:${owner.userId}`) });
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
      return error(500, -32603, "Internal server error", id);
    } finally {
      // JSON response mode has fully produced the body by now.
      void transport.close().catch(() => {});
      void server.close().catch(() => {});
    }
  };
}
