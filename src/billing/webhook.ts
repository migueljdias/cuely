import type { AccountStore } from "@/accounts/store";
import { verifyStripeSignature, type PaymentsConfig } from "./stripe";

/** Handles one Stripe webhook delivery. Returns the HTTP status to answer with. */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  cfg: PaymentsConfig,
  store: AccountStore | null,
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
      const periodEnd = obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end ?? null;
      await store.applySubscription({
        customerId: obj.customer,
        subscriptionId: obj.id,
        status: event.type === "customer.subscription.deleted" ? "canceled" : obj.status,
        currentPeriodEnd: periodEnd,
      });
      break;
    }
    default:
      break;
  }
  // Recorded after the update: every update above is idempotent, so a retry is harmless.
  await store.markEvent(event.id, event.type);
  return { status: 200, message: "ok" };
}
