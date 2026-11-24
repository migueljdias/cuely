import type { AccountStore } from "@/accounts/store";
import { stripeGet, type PaymentsConfig } from "./stripe";

/**
 * Applies a finished Checkout Session's subscription to the account that started it, read
 * from Stripe itself. Called when the buyer lands back on the billing page, so the plan
 * changes straight away instead of waiting for the webhook (which still runs, and applies
 * the same state). Does nothing unless the session belongs to this user and is paid.
 */
export async function syncCheckoutSession(
  cfg: PaymentsConfig,
  store: AccountStore,
  userId: string,
  sessionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<"applied" | "ignored"> {
  if (cfg.mode === "off" || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return "ignored";
  const s = await stripeGet(cfg, `checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`, fetchImpl);
  if (Boolean(s.livemode) !== (cfg.mode === "live")) return "ignored";
  if (s.client_reference_id !== userId || s.mode !== "subscription" || s.status !== "complete") return "ignored";
  const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
  const sub = s.subscription;
  if (!customerId || !sub || typeof sub !== "object") return "ignored";
  await store.setStripeCustomer(userId, customerId);
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
  const ok = await store.applySubscription({ customerId, subscriptionId: sub.id, status: sub.status, currentPeriodEnd: periodEnd });
  return ok ? "applied" : "ignored";
}
