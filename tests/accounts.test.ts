import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey, looksLikeApiKey, readApiKey } from "@/accounts/keys";
import { accountStore } from "@/accounts/store";
import { formEncode, paymentsConfig, signStripePayload, verifyStripeSignature } from "@/billing/stripe";
import { handleStripeWebhook } from "@/billing/webhook";
import { createMcpHandler } from "@/mcp/http";
import { createRateLimiter } from "@/mcp/rate-limit";
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
  it("is off by default and refuses mismatched keys", () => {
    expect(paymentsConfig({}).mode).toBe("off");
    expect(paymentsConfig({ PAYMENTS_MODE: "test", STRIPE_SECRET_KEY: "sk_live_x", STRIPE_PRICE_PRO: "price_1" }).mode).toBe("off");
    expect(paymentsConfig({ PAYMENTS_MODE: "live", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PRO: "price_1" }).mode).toBe("off");
    expect(paymentsConfig({ PAYMENTS_MODE: "test", STRIPE_SECRET_KEY: "sk_test_x" }).mode).toBe("off");
    expect(paymentsConfig({ PAYMENTS_MODE: "test", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PRO: "price_1" }).mode).toBe("test");
  });

  it("encodes nested params the way Stripe expects", () => {
    const body = formEncode({ mode: "subscription", line_items: [{ price: "price_1", quantity: 1 }], metadata: { a: "b c" } }).join("&");
    expect(body).toBe("mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Ba%5D=b%20c");
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
  const deliver = (event: object) => {
    const raw = JSON.stringify(event);
    return handleStripeWebhook(raw, signStripePayload(raw, "whsec_test"), cfg, store);
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
    expect((await deliver(sub("active", "evt_a", "customer.subscription.created"))).status).toBe(200);
    expect((await store.get("user_1"))?.plan).toBe("pro");
    expect((await deliver(sub("active", "evt_a", "customer.subscription.created"))).status).toBe(200);
    expect((await deliver(sub("canceled", "evt_b", "customer.subscription.deleted"))).status).toBe(200);
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
    await store.revokeKey("user_1", row.id);
    expect(await store.resolveKey(key)).toBeNull();
  });
});

describe("MCP with an API key", () => {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
  const send = (url: string | URL, key?: string) =>
    fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "x-forwarded-for": "9.9.9.9",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body,
    });

  it("works with no key, rejects an unknown key, and limits by the key's plan", async () => {
    const srv = await serve(
      createMcpHandler({
        repo: memoryRepository(),
        limiter: createRateLimiter(1),
        keyLimiters: { free: createRateLimiter(2), pro: createRateLimiter(5) },
        keyLookup: async (k) => (k === "cuely_free" ? { keyId: 1, plan: "free" } : k === "cuely_pro" ? { keyId: 2, plan: "pro" } : null),
      }),
    );
    expect((await send(srv.url)).status).toBe(200);
    expect((await send(srv.url)).status).toBe(429);
    expect((await send(srv.url, "cuely_nope")).status).toBe(401);
    expect((await send(srv.url, "cuely_free")).status).toBe(200);
    expect((await send(srv.url, "cuely_free")).status).toBe(200);
    expect((await send(srv.url, "cuely_free")).status).toBe(429);
    const pro = await send(srv.url, "cuely_pro");
    expect(pro.status).toBe(200);
    expect(pro.headers.get("x-ratelimit-limit")).toBe("1200");
    await srv.close();
  });
});
