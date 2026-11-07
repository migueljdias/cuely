"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountStore } from "@/accounts/store";
import { currentUser } from "@/auth/server";
import { paymentsConfig, priceMatches, stripeGet, stripePost, type StripePrice } from "@/billing/stripe";
import { PLANS } from "@/plans";

const SITE = process.env.CUELY_SITE_URL ?? "https://cuely.dev";

async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  const store = await getAccountStore();
  if (!store) throw new Error("No database configured.");
  const account = await store.ensure(user.id, user.email);
  return { user, store, account };
}

export type KeyState = { key?: string; error?: string } | null;

export async function createKeyAction(_prev: KeyState, form: FormData): Promise<KeyState> {
  const { user, store } = await requireUser();
  const existing = await store.listKeys(user.id);
  if (existing.length >= 10) return { error: "You have 10 keys. Revoke one to make another." };
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

/** Starts Stripe Checkout for Pro. Only runs when PAYMENTS_MODE is test or live with a matching key. */
export async function checkoutAction(): Promise<void> {
  const { user, store, account } = await requireUser();
  const cfg = paymentsConfig();
  if (cfg.mode === "off") redirect("/pricing?payments=off");
  if (account.plan === "pro") redirect("/account");

  // Never charge a different amount from the one the pricing page shows.
  const price = await stripeGet<StripePrice>(cfg, `prices/${cfg.priceId}`);
  if (!priceMatches(price, PLANS.pro.priceCents)) redirect("/pricing?payments=mismatch");

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
    success_url: `${SITE}/account?checkout=done`,
    cancel_url: `${SITE}/pricing`,
    subscription_data: { metadata: { cuely_user_id: user.id } },
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
    return_url: `${SITE}/account`,
  });
  redirect(session.url);
}
