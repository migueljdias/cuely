import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe over its REST API, with no SDK. Payments are off unless PAYMENTS_MODE says
 * otherwise, and each mode only accepts keys of its own kind, so a test setup can
 * never charge a real card by accident.
 *
 *   PAYMENTS_MODE=off   (default) checkout and portal are unavailable
 *   PAYMENTS_MODE=test  needs STRIPE_SECRET_KEY starting sk_test_
 *   PAYMENTS_MODE=live  needs STRIPE_SECRET_KEY starting sk_live_
 *
 * Checkout uses Stripe Managed Payments (Stripe is merchant of record and handles
 * sales tax and VAT) unless STRIPE_MANAGED_PAYMENTS=off.
 */
export type PaymentsMode = "off" | "test" | "live";

export interface PaymentsConfig {
  mode: PaymentsMode;
  /** Why payments are off, when they are. */
  reason?: string;
  secretKey?: string;
  priceId?: string;
  webhookSecret?: string;
  /** Stripe acts as merchant of record at checkout. */
  managedPayments?: boolean;
}

export function paymentsConfig(env: Record<string, string | undefined> = process.env): PaymentsConfig {
  const mode = (env.PAYMENTS_MODE ?? "off").trim().toLowerCase();
  if (mode !== "test" && mode !== "live") return { mode: "off", reason: "Payments are not switched on yet." };
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const priceId = env.STRIPE_PRICE_PRO?.trim();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  const want = mode === "test" ? "sk_test_" : "sk_live_";
  if (!secretKey || !secretKey.startsWith(want)) {
    return { mode: "off", reason: `PAYMENTS_MODE=${mode} needs a STRIPE_SECRET_KEY starting ${want}.` };
  }
  if (!priceId || !priceId.startsWith("price_")) {
    return { mode: "off", reason: "STRIPE_PRICE_PRO is missing." };
  }
  const managedPayments = (env.STRIPE_MANAGED_PAYMENTS ?? "on").trim().toLowerCase() !== "off";
  return { mode, secretKey, priceId, webhookSecret, managedPayments };
}

/** Flattens nested params into Stripe's form encoding: a[b][0]=c. */
export function formEncode(params: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") out.push(...formEncode(item as Record<string, unknown>, `${key}[${i}]`));
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      out.push(...formEncode(v as Record<string, unknown>, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

export async function stripeGet<T = any>(cfg: PaymentsConfig, path: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  if (cfg.mode === "off" || !cfg.secretKey) throw new Error("Payments are off.");
  const res = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
    headers: { authorization: `Bearer ${cfg.secretKey}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? `Stripe returned ${res.status}`);
  return body as T;
}

export interface StripePrice {
  unit_amount: number | null;
  currency: string;
  active: boolean;
  recurring: { interval: string; interval_count: number } | null;
}

/** True only for an active US dollar price billed once a month at exactly `cents`. */
export function priceMatches(price: StripePrice, cents: number): boolean {
  return (
    price.active &&
    price.currency === "usd" &&
    price.unit_amount === cents &&
    price.recurring?.interval === "month" &&
    price.recurring.interval_count === 1
  );
}

export async function stripePost<T = any>(
  cfg: PaymentsConfig,
  path: string,
  params: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  if (cfg.mode === "off" || !cfg.secretKey) throw new Error("Payments are off.");
  const res = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: formEncode(params).join("&"),
  });
  const body = (await res.json()) as any;
  if (!res.ok) throw new Error(`Stripe ${path} failed: ${body?.error?.message ?? res.status}`);
  return body as T;
}

/**
 * Checks a Stripe-Signature header (t=...,v1=...) against the raw body.
 * Rejects anything older than toleranceSeconds to stop replays.
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  if (!header || !secret) return false;
  let t = "";
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") t = v;
    else if (k === "v1" && v) sigs.push(v);
  }
  const ts = Number(t);
  if (!t || !Number.isFinite(ts) || sigs.length === 0) return false;
  if (Math.abs(nowSeconds - ts) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest();
  return sigs.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** Builds a valid header, for tests and local webhook replays. */
export function signStripePayload(payload: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${v1}`;
}
