"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountStore } from "@/accounts/store";
import { currentUser } from "@/auth/server";
import { checkoutOpen, paymentsConfig, priceMatches, stripeGet, stripePost, type StripePrice } from "@/billing/stripe";
import { PLANS, planFor } from "@/plans";
import { APP_URL } from "@/site";

// Overridable for local testing; production uses app.cuely.dev.
const APP = process.env.CUELY_APP_URL ?? APP_URL;

async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const store = await getAccountStore();
  if (!store) throw new Error("No database configured.");
  const account = await store.ensure(user.id, user.email);
  return { user, store, account };
}

export type KeyState = { key?: string; error?: string } | null;

export async function createKeyAction(_prev: KeyState, form: FormData): Promise<KeyState> {
  const { user, store, account } = await requireUser();
  const plan = planFor(account.plan);
  const existing = await store.countKeys(user.id);
  if (existing >= plan.maxKeys) {
    return {
      error:
        plan.id === "free"
          ? "The Free plan has one key. Revoke it to make a new one, or upgrade to Pro for up to 10."
          : `You have ${plan.maxKeys} keys. Revoke one to make another.`,
    };
  }
  const key = await store.createKey(user.id, String(form.get("name") ?? "").trim() || "default");
  revalidatePath("/account", "layout");
  return { key };
}

/** Saves the product-updates checkbox. Unchecked (or missing) means off. */
export async function productUpdatesAction(form: FormData): Promise<void> {
  const { user, store } = await requireUser();
  await store.setProductUpdates(user.id, form.get("product_updates") === "on");
  revalidatePath("/account/settings");
  redirect("/account/settings?updates=saved");
}

export async function revokeKeyAction(form: FormData): Promise<void> {
  const { user, store } = await requireUser();
  const id = Number(form.get("id"));
  if (Number.isInteger(id)) await store.revokeKey(user.id, id);
  revalidatePath("/account", "layout");
}

/** Starts Stripe Checkout for Pro. Only runs where checkoutOpen() allows it. */
/** Logs why checkout didn't start, with no keys or ids beyond the account, so the reason is in the runtime logs. */
function blocked(account: string, reason: string, extra: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ event: "checkout_blocked", account, reason, ...extra }));
}

export async function checkoutAction(): Promise<void> {
  const { user, store, account } = await requireUser();
  const cfg = paymentsConfig();
  if (cfg.mode === "off" || !checkoutOpen(cfg)) {
    // Payments aren't switched on here: grant nothing, start nothing, and log why.
    blocked(account.userId, cfg.mode === "off" ? (cfg.reason ?? "Payments are off.") : "Test mode doesn't open checkout in production.", {
      mode: cfg.mode,
      vercelEnv: process.env.VERCEL_ENV ?? null,
    });
    console.info(JSON.stringify({ event: "pro_interest", account: account.userId }));
    redirect("/account/billing?checkout=soon");
  }
  if (account.plan === "pro") redirect("/account/billing");

  let url: string | null = null;
  try {
    // Never charge a different amount from the one the pricing page shows.
    const price = await stripeGet<StripePrice>(cfg, `prices/${cfg.priceId}`);
    if (!priceMatches(price, PLANS.pro.priceCents)) {
      blocked(account.userId, "The Stripe price doesn't match the pricing page.", {
        mode: cfg.mode,
        want: { amount: PLANS.pro.priceCents, currency: "usd", interval: "month", active: true },
        got: { amount: price.unit_amount, currency: price.currency, interval: price.recurring?.interval ?? null, intervalCount: price.recurring?.interval_count ?? null, active: price.active },
      });
    } else {
      let customerId = account.stripeCustomerId;
      if (!customerId) {
        // Created before checkout, so every webhook that follows can find this account.
        const customer = await stripePost<{ id: string }>(cfg, "customers", {
          email: user.email ?? undefined,
          metadata: { cuely_user_id: user.id },
        });
        customerId = customer.id;
        await store.setStripeCustomer(user.id, customerId);
      }

      const session = await stripePost<{ url: string }>(cfg, "checkout/sessions", {
        mode: "subscription",
        customer: customerId,
        client_reference_id: user.id,
        line_items: [{ price: cfg.priceId, quantity: 1 }],
        allow_promotion_codes: "true",
        success_url: `${APP}/account/billing?checkout=done`,
        cancel_url: `${APP}/account/billing`,
        subscription_data: { metadata: { cuely_user_id: user.id } },
        // Stripe as merchant of record: it collects and files sales tax and VAT.
        ...(cfg.managedPayments ? { managed_payments: { enabled: "true" } } : {}),
      });
      url = session.url;
    }
  } catch (err) {
    // Stripe's message names the problem (unknown price, key for the wrong account, managed payments not enabled).
    blocked(account.userId, err instanceof Error ? err.message : String(err), { mode: cfg.mode, managedPayments: cfg.managedPayments });
  }
  redirect(url ?? "/account/billing?checkout=unavailable");
}

/** Opens the Stripe customer portal, where cards, invoices and cancelling live. */
export async function portalAction(): Promise<void> {
  const { account } = await requireUser();
  const cfg = paymentsConfig();
  if (cfg.mode === "off" || !account.stripeCustomerId) redirect("/account/billing");
  const session = await stripePost<{ url: string }>(cfg, "billing_portal/sessions", {
    customer: account.stripeCustomerId,
    return_url: `${APP}/account/billing`,
  });
  redirect(session.url);
}
