import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey, looksLikeApiKey, readApiKey } from "@/accounts/keys";
import { accountStore } from "@/accounts/store";
import { checkoutOpen, formEncode, paymentsConfig, priceMatches, signStripePayload, verifyStripeSignature } from "@/billing/stripe";
import { handleStripeWebhook } from "@/billing/webhook";
import { createMcpHandler, memoryUsageCounter, nextUtcMidnight } from "@/mcp/http";
import { clerkIssuer, protectedResourceMetadata } from "@/mcp/oauth";
import { PLANS } from "@/plans";
import { memoryRepository } from "@/repo";
import { serve } from "./helpers";

const schema = readFileSync(path.resolve(import.meta.dirname, "../db/schema.sql"), "utf8");

describe("API keys", () => {
  it("are random, prefixed, and stored only as a hash", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
    expect(looksLikeApiKey(a.key)).toBe(true);
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.hash).not.toContain(a.key);
    expect(a.key.startsWith(a.prefix)).toBe(true);
  });

  it("are read from a Bearer header or x-api-key", () => {
    const r1 = new Request("http://x", { headers: { authorization: "Bearer cuely_abc" } });
    const r2 = new Request("http://x", { headers: { "x-api-key": "cuely_def" } });
    expect(readApiKey(r1)).toBe("cuely_abc");
    expect(readApiKey(r2)).toBe("cuely_def");
    expect(readApiKey(new Request("http://x"))).toBeNull();
  });
});

describe("Payments switch", () => {
  it("uses the *_LIVE values in live mode and ignores them in test mode", () => {
    const env = {
      PAYMENTS_MODE: "live",
      STRIPE_SECRET_KEY: "sk_test_sandbox",
      STRIPE_PRICE_PRO: "price_sandbox",
      STRIPE_WEBHOOK_SECRET: "whsec_sandbox",
      STRIPE_SECRET_KEY_LIVE: "sk_live_real",
      STRIPE_PRICE_PRO_LIVE: "price_live",
      STRIPE_WEBHOOK_SECRET_LIVE: "whsec_live",
    };
    const live = paymentsConfig(env);
    expect(live.mode).toBe("live");
    expect(live.priceId).toBe("price_live");
    expect(live.webhookSecret).toBe("whsec_live");
    const test = paymentsConfig({ ...env, PAYMENTS_MODE: "test" });
    expect(test.mode).toBe("test");
    expect(test.priceId).toBe("price_sandbox");
    expect(test.webhookSecret).toBe("whsec_sandbox");
    // Live without a live key stays off rather than charging with a test key.
    expect(paymentsConfig({ ...env, STRIPE_SECRET_KEY_LIVE: undefined }).mode).toBe("off");
  });

  it("only opens checkout in live mode, or in test mode outside production", () => {
    const test = paymentsConfig({ PAYMENTS_MODE: "test", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PRO: "price_1" });
    const live = paymentsConfig({ PAYMENTS_MODE: "live", STRIPE_SECRET_KEY: "sk_live_x", STRIPE_PRICE_PRO: "price_1" });
    expect(checkoutOpen(test, { VERCEL_ENV: "production" })).toBe(false);
    expect(checkoutOpen(test, { VERCEL_ENV: "preview" })).toBe(true);
    expect(checkoutOpen(test, {})).toBe(true);
    expect(checkoutOpen(live, { VERCEL_ENV: "production" })).toBe(true);
    expect(checkoutOpen(paymentsConfig({}), {})).toBe(false);
  });

  it("is off by default and refuses mismatched keys", () => {
    expect(paymentsConfig({}).mode).toBe("off");
    expect(paymentsConfig({ PAYMENTS_MODE: "test", STRIPE_SECRET_KEY: "sk_live_x", STRIPE_PRICE_PRO: "price_1" }).mode).toBe("off");
    expect(paymentsConfig({ PAYMENTS_MODE: "live", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PRO: "price_1" }).mode).toBe("off");
    expect(paymentsConfig({ PAYMENTS_MODE: "test", STRIPE_SECRET_KEY: "sk_test_x" }).mode).toBe("off");
    expect(paymentsConfig({ PAYMENTS_MODE: "test", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PRO: "price_1" }).mode).toBe("test");
    expect(paymentsConfig({ PAYMENTS_MODE: "test", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PRO: "price_1" }).managedPayments).toBe(true);
    expect(
      paymentsConfig({ PAYMENTS_MODE: "test", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PRO: "price_1", STRIPE_MANAGED_PAYMENTS: "off" })
        .managedPayments,
    ).toBe(false);
  });

  it("encodes nested params the way Stripe expects", () => {
    const body = formEncode({ mode: "subscription", line_items: [{ price: "price_1", quantity: 1 }], metadata: { a: "b c" } }).join("&");
    expect(body).toBe("mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Ba%5D=b%20c");
  });

  it("only accepts a Stripe price that matches the advertised $10 a month", () => {
    const ok = { active: true, currency: "usd", unit_amount: 1000, recurring: { interval: "month", interval_count: 1 } };
    expect(PLANS.pro.priceCents).toBe(1000);
    expect(priceMatches(ok, PLANS.pro.priceCents)).toBe(true);
    expect(priceMatches({ ...ok, unit_amount: 1500 }, 1000)).toBe(false);
    expect(priceMatches({ ...ok, currency: "eur" }, 1000)).toBe(false);
    expect(priceMatches({ ...ok, recurring: { interval: "year", interval_count: 1 } }, 1000)).toBe(false);
    expect(priceMatches({ ...ok, active: false }, 1000)).toBe(false);
  });

  it("verifies webhook signatures and rejects stale or forged ones", () => {
    const payload = '{"id":"evt_1"}';
    const now = 1_800_000_000;
    const header = signStripePayload(payload, "whsec_test", now);
    expect(verifyStripeSignature(payload, header, "whsec_test", now)).toBe(true);
    expect(verifyStripeSignature(payload, header, "whsec_other", now)).toBe(false);
    expect(verifyStripeSignature(payload + " ", header, "whsec_test", now)).toBe(false);
    expect(verifyStripeSignature(payload, header, "whsec_test", now + 3600)).toBe(false);
    expect(verifyStripeSignature(payload, null, "whsec_test", now)).toBe(false);
  });
});

describe("Accounts and the Stripe webhook", () => {
  const db = new PGlite();
  const query = async (text: string, params?: unknown[]) => (await db.query(text, params)).rows as Record<string, any>[];
  const store = accountStore(query);
  const cfg = paymentsConfig({
    PAYMENTS_MODE: "test",
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_PRICE_PRO: "price_1",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
  });
  // What Stripe says the subscription looks like right now.
  let stripeNow: Record<string, any> = {};
  const fakeStripe = (async (url: string) => {
    const id = decodeURIComponent(String(url).split("/subscriptions/")[1] ?? "");
    const sub = stripeNow[id];
    return sub
      ? new Response(JSON.stringify(sub), { status: 200 })
      : new Response(JSON.stringify({ error: { message: "No such subscription" } }), { status: 404 });
  }) as typeof fetch;
  const deliver = (event: object) => {
    const raw = JSON.stringify(event);
    return handleStripeWebhook(raw, signStripePayload(raw, "whsec_test"), cfg, store, fakeStripe);
  };

  beforeAll(async () => {
    await db.exec(schema);
  });

  it("creates a free account and stores only the Stripe customer ID", async () => {
    const a = await store.ensure("user_1", "a@example.com");
    expect(a.plan).toBe("free");
    await store.setStripeCustomer("user_1", "cus_1");
    expect((await store.get("user_1"))?.stripeCustomerId).toBe("cus_1");
    const cols = (await query("select column_name from information_schema.columns where table_name = 'accounts'")).map((r) => r.column_name);
    expect(cols.some((c) => /card|pan|cvc|number/.test(c))).toBe(false);
  });

  it("turns Pro on and off from subscription events, once per event", async () => {
    const sub = (status: string, id: string, type = "customer.subscription.updated") => ({
      id,
      type,
      livemode: false,
      data: { object: { id: "sub_1", customer: "cus_1", status, current_period_end: 1_900_000_000 } },
    });
    const now = (status: string) => (stripeNow = { sub_1: { id: "sub_1", customer: "cus_1", status, current_period_end: 1_900_000_000 } });
    now("active");
    expect((await deliver(sub("active", "evt_a", "customer.subscription.created"))).status).toBe(200);
    expect((await store.get("user_1"))?.plan).toBe("pro");
    expect((await deliver(sub("active", "evt_a", "customer.subscription.created"))).status).toBe(200);
    now("canceled");
    expect((await deliver(sub("canceled", "evt_b", "customer.subscription.deleted"))).status).toBe(200);
    expect((await store.get("user_1"))?.plan).toBe("free");
  });

  it("goes by Stripe's current state when an old event arrives late", async () => {
    stripeNow = { sub_1: { id: "sub_1", customer: "cus_1", status: "canceled", current_period_end: 1_900_000_000 } };
    const late = { id: "evt_late", type: "customer.subscription.updated", livemode: false, data: { object: { id: "sub_1", customer: "cus_1", status: "active" } } };
    expect((await deliver(late)).status).toBe(200);
    expect((await store.get("user_1"))?.plan).toBe("free");
  });

  it("asks Stripe to retry when the subscription can't be read", async () => {
    stripeNow = {};
    const ev = { id: "evt_missing", type: "customer.subscription.updated", livemode: false, data: { object: { id: "sub_404", customer: "cus_1", status: "active" } } };
    expect((await deliver(ev)).status).toBe(503);
    expect((await store.get("user_1"))?.plan).toBe("free");
  });

  it("ignores events from the other mode and unsigned deliveries", async () => {
    const live = { id: "evt_live", type: "customer.subscription.updated", livemode: true, data: { object: { customer: "cus_1", status: "active" } } };
    expect((await deliver(live)).status).toBe(400);
    expect((await handleStripeWebhook("{}", "t=1,v1=00", cfg, store)).status).toBe(400);
    expect((await handleStripeWebhook("{}", null, paymentsConfig({}), store)).status).toBe(503);
  });

  it("creates, resolves and revokes API keys", async () => {
    const key = await store.createKey("user_1", "laptop");
    const found = await store.resolveKey(key);
    expect(found?.userId).toBe("user_1");
    const [row] = await store.listKeys("user_1");
    expect(row.lastUsedAt).not.toBeNull();
    const stored = await query("select key_hash from api_keys");
    expect(JSON.stringify(stored)).not.toContain(key);
    expect(await store.countKeys("user_1")).toBe(1);
    await store.revokeKey("user_1", row.id);
    expect(await store.resolveKey(key)).toBeNull();
    expect(await store.countKeys("user_1")).toBe(0);
  });

  it("counts tool calls per day and requests per minute in one upsert", async () => {
    await store.ensure("user_2", null);
    const a = await store.countRequest("user_2", 0);
    expect(a).toMatchObject({ calls: 0, minuteCalls: 1 });
    const b = await store.countRequest("user_2", 1);
    expect(b.calls).toBe(1);
    expect(b.minuteCalls).toBe(2);
    // A new minute starts the minute count again; the day keeps counting.
    await query("update api_usage set minute_start = minute_start - interval '1 minute' where user_id = 'user_2'");
    const c = await store.countRequest("user_2", 2);
    expect(c).toMatchObject({ calls: 3, minuteCalls: 1 });
    const usage = await store.usage("user_2");
    expect(usage).toHaveLength(1);
    expect(usage[0].calls).toBe(3);
  });
});

describe("MCP access and plan limits", () => {
  const call = (n: number) => JSON.stringify({ jsonrpc: "2.0", id: n, method: "tools/call", params: { name: "list_categories", arguments: {} } });
  const list = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
  const send = (url: string | URL, body: string, auth?: string) =>
    fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "x-forwarded-for": "9.9.9.9",
        ...(auth ? { authorization: `Bearer ${auth}` } : {}),
      },
      body,
    });
  const owners: Record<string, { keyId: number; userId: string; plan: "free" | "pro" }> = {
    cuely_free: { keyId: 1, userId: "user_f", plan: "free" },
    cuely_free2: { keyId: 2, userId: "user_f", plan: "free" },
    cuely_pro: { keyId: 3, userId: "user_p", plan: "pro" },
  };
  const make = (now: () => number) =>
    createMcpHandler({
      repo: memoryRepository(),
      keyLookup: async (k) => owners[k] ?? null,
      oauthLookup: async (_req, token) => (token === "aa.bb.cc" ? { keyId: 0, userId: "user_o", plan: "free" } : null),
      countUsage: memoryUsageCounter(now),
      now,
    });

  it("needs a key or a sign-in, and rejects unknown ones", async () => {
    const srv = await serve(make(Date.now));
    expect((await send(srv.url, list)).status).toBe(401);
    expect((await send(srv.url, list, "cuely_nope")).status).toBe(401);
    const bad = await send(srv.url, list, "xx.yy.zz");
    expect(bad.status).toBe(401);
    expect(bad.headers.get("www-authenticate")).toMatch(/error="invalid_token"/);
    expect((await send(srv.url, list, "cuely_free")).status).toBe(200);
    expect((await send(srv.url, list, "aa.bb.cc")).status).toBe(200);
    await srv.close();
  });

  it("caps Free at its daily tool-call limit per account, across keys, with a reset time and upgrade link", async () => {
    let t = Date.UTC(2026, 10, 7, 18, 0, 0);
    const srv = await serve(make(() => t));
    for (let i = 0; i < PLANS.free.perDay; i++) {
      if (i % 25 === 0) t += 61_000; // stay under the per-minute limit
      const res = await send(srv.url, call(i), i % 2 ? "cuely_free" : "cuely_free2");
      expect(res.status).toBe(200);
    }
    const over = await send(srv.url, call(999), "cuely_free");
    expect(over.status).toBe(429);
    const body = await over.json();
    expect(body.id).toBe(999);
    expect(body.error.data.limit).toBe("day");
    expect(body.error.data.reset_at).toBe(new Date(nextUtcMidnight(t)).toISOString());
    expect(body.error.data.upgrade_url).toBe("https://app.cuely.dev/account");
    expect(body.error.message).toContain(`${PLANS.free.perDay} tool calls a day`);
    expect(Number(over.headers.get("retry-after"))).toBeGreaterThan(0);
    // Listing tools still works, so the client can connect and show the error on the call.
    expect((await send(srv.url, list, "cuely_free")).status).toBe(200);
    // The next UTC day starts fresh.
    t = nextUtcMidnight(t) + 1000;
    expect((await send(srv.url, call(1000), "cuely_free")).status).toBe(200);
    await srv.close();
  });

  it("caps requests per minute by plan", async () => {
    const t = Date.UTC(2026, 10, 7, 18, 0, 5);
    const srv = await serve(make(() => t));
    for (let i = 0; i < PLANS.free.perMinute; i++) expect((await send(srv.url, list, "cuely_free")).status).toBe(200);
    const over = await send(srv.url, list, "cuely_free");
    expect(over.status).toBe(429);
    expect((await over.json()).error.data.limit).toBe("minute");
    expect(over.headers.get("retry-after")).toBe("55");
    for (let i = 0; i < PLANS.free.perMinute + 1; i++) expect((await send(srv.url, list, "cuely_pro")).status).toBe(200);
    const pro = await send(srv.url, call(1), "cuely_pro");
    expect(pro.headers.get("x-ratelimit-limit")).toBe("5000");
    expect(pro.headers.get("x-ratelimit-remaining")).toBe("4999");
    await srv.close();
  });
});

describe("OAuth metadata", () => {
  it("names Clerk as the authorization server for this MCP URL", () => {
    const pk = `pk_live_${Buffer.from("clerk.cuely.dev$").toString("base64")}`;
    expect(clerkIssuer({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk })).toBe("https://clerk.cuely.dev");
    expect(clerkIssuer({})).toBeNull();
    const meta = protectedResourceMetadata();
    expect(meta.resource).toBe("https://cuely.dev/api/mcp");
  });
});
