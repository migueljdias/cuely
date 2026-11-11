"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountStore } from "@/accounts/store";
import { currentUser } from "@/auth/server";
import { checkoutOpen, paymentsConfig, priceMatches, stripeGet, stripePost, type StripePrice } from "@/billing/stripe";
import { PLANS, planFor } from "@/plans";
import { APP_URL, SITE_URL } from "@/site";

// Overridable for local testing; production uses cuely.dev and app.cuely.dev.
const SITE = process.env.CUELY_SITE_URL ?? SITE_URL;
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
  revalidatePath("/account");
  return { key };
}

export async function revokeKeyAction(form: FormData): Promise<void> {
  const { user, store } = await requireUser();
  const id = Number(form.get("id"));
  if (Number.isInteger(id)) await store.revokeKey(user.id, id);
  revalidatePath("/account");
}

/** Starts Stripe Checkout for Pro. Only runs where checkoutOpen() allows it. */
export async function checkoutAction(): Promise<void> {
  const { user, store, account } = await requireUser();
  const cfg = paymentsConfig();
  if (cfg.mode === "off" || !checkoutOpen(cfg)) redirect("/account?checkout=soon");
  if (account.plan === "pro") redirect("/account");

  // Never charge a different amount from the one the pricing page shows.
  const price = await stripeGet<StripePrice>(cfg, `prices/${cfg.priceId}`);
  if (!priceMatches(price, PLANS.pro.priceCents)) redirect(`${SITE}/pricing?payments=mismatch`);

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
    success_url: `${APP}/account?checkout=done`,
    cancel_url: `${SITE}/pricing`,
    subscription_data: { metadata: { cuely_user_id: user.id } },
    // Stripe as merchant of record: it collects and files sales tax and VAT.
    ...(cfg.managedPayments ? { managed_payments: { enabled: "true" } } : {}),
  });
  redirect(session.url);
}

/** Opens the Stripe customer portal, where cards, invoices and cancelling live. */
export async function portalAction(): Promise<void> {
  const { account } = await requireUser();
  const cfg = paymentsConfig();
  if (cfg.mode === "off" || !account.stripeCustomerId) redirect("/account");
  const session = await stripePost<{ url: string }>(cfg, "billing_portal/sessions", {
    customer: account.stripeCustomerId,
    return_url: `${APP}/account`,
  });
  redirect(session.url);
}
