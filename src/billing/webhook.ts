import type { AccountStore } from "@/accounts/store";
import { stripeGet, verifyStripeSignature, type PaymentsConfig } from "./stripe";

/** Handles one Stripe webhook delivery. Returns the HTTP status to answer with. */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  cfg: PaymentsConfig,
  store: AccountStore | null,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; message: string }> {
  if (cfg.mode === "off" || !cfg.webhookSecret) return { status: 503, message: "Payments are off." };
  if (!verifyStripeSignature(rawBody, signature, cfg.webhookSecret)) return { status: 400, message: "Bad signature." };
  if (!store) return { status: 503, message: "No database." };

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, message: "Bad JSON." };
  }
  // A test-mode event must never change a live setup, and the other way round.
  if (Boolean(event.livemode) !== (cfg.mode === "live")) return { status: 400, message: "Wrong mode." };

  const obj = event.data?.object ?? {};
  switch (event.type) {
    case "checkout.session.completed": {
      const userId = obj.client_reference_id;
      if (userId && obj.customer) await store.setStripeCustomer(userId, obj.customer);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // Stripe can deliver events late or out of order, so the event only says which
      // subscription changed. Its current state comes from Stripe itself.
      if (typeof obj.id !== "string" || !obj.id.startsWith("sub_")) break;
      let current: any;
      try {
        current = await stripeGet(cfg, `subscriptions/${encodeURIComponent(obj.id)}`, fetchImpl);
      } catch (err) {
        console.error("stripe subscription read failed", err);
        // Stripe retries a failed delivery, so the plan catches up once Stripe answers.
        return { status: 503, message: "Couldn't read the subscription from Stripe." };
      }
      const periodEnd = current.current_period_end ?? current.items?.data?.[0]?.current_period_end ?? null;
      await store.applySubscription({
        customerId: typeof current.customer === "string" ? current.customer : current.customer?.id,
        subscriptionId: current.id,
        status: current.status,
        currentPeriodEnd: periodEnd,
      });
      break;
    }
    default:
      break;
  }
  // Recorded after the update. Each update applies Stripe's current state, so a retry or a late event is harmless.
  await store.markEvent(event.id, event.type);
  return { status: 200, message: "ok" };
}
