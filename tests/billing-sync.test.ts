import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { accountStore } from "@/accounts/store";
import { paymentsConfig } from "@/billing/stripe";
import { syncCheckoutSession } from "@/billing/sync";

const schema = readFileSync(path.resolve(import.meta.dirname, "../db/schema.sql"), "utf8");

describe("Applying a checkout session on return", () => {
  const db = new PGlite();
  const query = async (text: string, params?: unknown[]) => (await db.query(text, params)).rows as Record<string, any>[];
  const store = accountStore(query);
  const cfg = paymentsConfig({ PAYMENTS_MODE: "test", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PRO: "price_1" });
  const session = (over: Record<string, unknown> = {}) => ({
    id: "cs_test_abc",
    livemode: false,
    mode: "subscription",
    status: "complete",
    client_reference_id: "user_s",
    customer: "cus_s",
    subscription: { id: "sub_s", status: "active", items: { data: [{ current_period_end: 1_900_000_000 }] } },
    ...over,
  });
  const stripe = (body: object) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

  beforeAll(async () => {
    await db.exec(schema);
    await store.ensure("user_s", "s@example.com");
    await store.ensure("user_other", "o@example.com");
  });

  it("ignores sessions that aren't this user's, aren't complete, or are from the other mode", async () => {
    expect(await syncCheckoutSession(cfg, store, "user_other", "cs_test_abc", stripe(session()))).toBe("ignored");
    expect(await syncCheckoutSession(cfg, store, "user_s", "cs_test_abc", stripe(session({ status: "open" })))).toBe("ignored");
    expect(await syncCheckoutSession(cfg, store, "user_s", "cs_test_abc", stripe(session({ livemode: true })))).toBe("ignored");
    expect(await syncCheckoutSession(cfg, store, "user_s", "not-a-session", stripe(session()))).toBe("ignored");
    expect((await store.get("user_s"))!.plan).toBe("free");
    expect((await store.get("user_other"))!.stripeCustomerId).toBeNull();
  });

  it("turns Pro on from the session's subscription", async () => {
    expect(await syncCheckoutSession(cfg, store, "user_s", "cs_test_abc", stripe(session()))).toBe("applied");
    const a = await store.get("user_s");
    expect(a).toMatchObject({ plan: "pro", planStatus: "active", stripeCustomerId: "cus_s" });
  });
});
