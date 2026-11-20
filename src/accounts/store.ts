import type { QueryFn } from "@/repo";
import { generateApiKey, hashApiKey } from "./keys";

export interface Account {
  userId: string;
  email: string | null;
  plan: "free" | "pro";
  planStatus: string | null;
  stripeCustomerId: string | null;
  currentPeriodEnd: string | null;
  /** Opted in to product-update emails. Off by default; only the account holder turns it on. */
  productUpdates: boolean;
}

export interface UsageCount {
  /** Tool calls today (UTC), including this request. */
  calls: number;
  /** Requests in the current minute, including this one. */
  minuteCalls: number;
  /** When the current minute window started, in ms. */
  minuteStart: number;
}

export interface ApiKeyRow {
  id: number;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const toAccount = (r: Record<string, any>): Account => ({
  userId: r.user_id,
  email: r.email ?? null,
  plan: r.plan === "pro" ? "pro" : "free",
  planStatus: r.plan_status ?? null,
  stripeCustomerId: r.stripe_customer_id ?? null,
  currentPeriodEnd: r.current_period_end ? new Date(r.current_period_end).toISOString() : null,
  productUpdates: r.product_updates === true,
});

/** Subscription statuses that keep Pro on. Anything else falls back to Free. */
export const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/** Account data: plan, Stripe customer ID and API key hashes. No card data, ever. */
export function accountStore(query: QueryFn) {
  return {
    async ensure(userId: string, email: string | null): Promise<Account> {
      const rows = await query(
        `insert into accounts (user_id, email) values ($1, $2)
         on conflict (user_id) do update set email = coalesce(excluded.email, accounts.email)
         returning *`,
        [userId, email],
      );
      return toAccount(rows[0]);
    },

    async get(userId: string): Promise<Account | null> {
      const rows = await query("select * from accounts where user_id = $1", [userId]);
      return rows[0] ? toAccount(rows[0]) : null;
    },

    /** Turns product-update emails on or off, and records when the choice was made. */
    async setProductUpdates(userId: string, on: boolean): Promise<void> {
      await query(
        `update accounts set product_updates = $2, product_updates_at = now(), updated_at = now()
         where user_id = $1 and product_updates is distinct from $2`,
        [userId, on],
      );
    },

    async setStripeCustomer(userId: string, customerId: string): Promise<void> {
      await query("update accounts set stripe_customer_id = $2, updated_at = now() where user_id = $1", [userId, customerId]);
    },

    /** Applies a Stripe subscription's state. Keyed by customer, so only Stripe's word changes a plan. */
    async applySubscription(sub: {
      customerId: string;
      subscriptionId: string;
      status: string;
      currentPeriodEnd: number | null;
    }): Promise<boolean> {
      const plan = ACTIVE_STATUSES.has(sub.status) ? "pro" : "free";
      const rows = await query(
        `update accounts set plan = $2, plan_status = $3, stripe_subscription_id = $4,
           current_period_end = $5, updated_at = now()
         where stripe_customer_id = $1 returning user_id`,
        [
          sub.customerId,
          plan,
          sub.status,
          sub.subscriptionId,
          sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd * 1000).toISOString() : null,
        ],
      );
      return rows.length > 0;
    },

    /** Records a webhook event id. Returns false when it was already handled. */
    async markEvent(id: string, type: string): Promise<boolean> {
      const rows = await query(
        "insert into stripe_events (id, type) values ($1, $2) on conflict (id) do nothing returning id",
        [id, type],
      );
      return rows.length > 0;
    },

    async listKeys(userId: string): Promise<ApiKeyRow[]> {
      const rows = await query(
        `select id, name, prefix, created_at, last_used_at from api_keys
         where user_id = $1 and revoked_at is null order by created_at desc`,
        [userId],
      );
      return rows.map((r) => ({
        id: Number(r.id),
        name: r.name,
        prefix: r.prefix,
        createdAt: new Date(r.created_at).toISOString(),
        lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
      }));
    },

    /** Creates a key and returns it in full, the only time it is ever visible. */
    async createKey(userId: string, name = "default"): Promise<string> {
      const { key, prefix, hash } = generateApiKey();
      await query("insert into api_keys (user_id, name, prefix, key_hash) values ($1, $2, $3, $4)", [
        userId,
        name.slice(0, 60) || "default",
        prefix,
        hash,
      ]);
      return key;
    },

    async revokeKey(userId: string, id: number): Promise<void> {
      await query("update api_keys set revoked_at = now() where user_id = $1 and id = $2 and revoked_at is null", [userId, id]);
    },

    async countKeys(userId: string): Promise<number> {
      const rows = await query("select count(*)::int as n from api_keys where user_id = $1 and revoked_at is null", [userId]);
      return Number(rows[0]?.n ?? 0);
    },

    /**
     * Counts one MCP request against the account, in one round trip: every request adds to
     * this minute's count, and toolCalls adds to today's (UTC) count. Returns both totals.
     */
    async countRequest(userId: string, toolCalls: number): Promise<UsageCount> {
      const rows = await query(
        `insert into api_usage as u (user_id, day, calls, minute_start, minute_calls)
         values ($1, (now() at time zone 'utc')::date, $2, date_trunc('minute', now()), 1)
         on conflict (user_id, day) do update set
           calls = u.calls + excluded.calls,
           minute_calls = case when u.minute_start = excluded.minute_start then u.minute_calls + 1 else 1 end,
           minute_start = excluded.minute_start
         returning calls, minute_calls, minute_start`,
        [userId, toolCalls],
      );
      const r = rows[0];
      return { calls: Number(r.calls), minuteCalls: Number(r.minute_calls), minuteStart: new Date(r.minute_start).getTime() };
    },

    /** Tool calls per UTC day, newest first, for the account page. */
    async usage(userId: string, days = 14): Promise<{ day: string; calls: number }[]> {
      const rows = await query(
        `select day::text as day, calls from api_usage
         where user_id = $1 and day > (now() at time zone 'utc')::date - $2::int
         order by day desc`,
        [userId, days],
      );
      return rows.map((r) => ({ day: String(r.day), calls: Number(r.calls) }));
    },

    /** Looks a presented key up. Returns its id and the owner's plan, or null. */
    async resolveKey(key: string): Promise<{ keyId: number; userId: string; plan: "free" | "pro" } | null> {
      const rows = await query(
        `update api_keys k set last_used_at = now()
         from accounts a
         where k.key_hash = $1 and k.revoked_at is null and a.user_id = k.user_id
         returning k.id, k.user_id, a.plan`,
        [hashApiKey(key)],
      );
      const r = rows[0];
      return r ? { keyId: Number(r.id), userId: r.user_id, plan: r.plan === "pro" ? "pro" : "free" } : null;
    },
  };
}

export type AccountStore = ReturnType<typeof accountStore>;

let store: AccountStore | null = null;

/** The account store on DATABASE_URL, or null when no database is configured. */
export async function getAccountStore(): Promise<AccountStore | null> {
  if (store) return store;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  store = accountStore(async (text, params) => (await sql.query(text, params ?? [])) as Record<string, any>[]);
  return store;
}
