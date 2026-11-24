"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccountStore, THEMES, type Theme } from "@/accounts/store";
import { deleteAccount } from "@/accounts/delete";
import { currentUser, deleteAuthUser } from "@/auth/server";
import { checkoutOpen, paymentsConfig, priceMatches, stripeGet, stripePost, type StripePrice } from "@/billing/stripe";
import { PLANS, planFor } from "@/plans";
import { APP_URL, SITE_URL } from "@/site";

// Overridable for local testing; production uses app.cuely.dev.
const APP = process.env.CUELY_APP_URL ?? APP_URL;

/**
 * Where Stripe sends people back to. Production always uses app.cuely.dev; previews and local
 * runs use the host the request came in on, so a test checkout returns to the same preview.
 */
async function appOrigin(): Promise<string> {
  if (process.env.VERCEL_ENV === "production") return APP;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return APP;
  const proto = h.get("x-forwarded-proto") === "http" || host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

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

/** Saves the app theme to the account, so it follows the holder to every browser. */
export async function setThemeAction(theme: string): Promise<{ ok: boolean }> {
  if (!THEMES.includes(theme as Theme)) return { ok: false };
  try {
    const { user, store } = await requireUser();
    await store.setTheme(user.id, theme as Theme);
  } catch (err) {
    console.error("setTheme failed", err);
    return { ok: false };
  }
  revalidatePath("/account", "layout");
  return { ok: true };
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

      const origin = await appOrigin();
      const session = await stripePost<{ url: string }>(cfg, "checkout/sessions", {
        mode: "subscription",
        customer: customerId,
        client_reference_id: user.id,
        line_items: [{ price: cfg.priceId, quantity: 1 }],
        allow_promotion_codes: "true",
        success_url: `${origin}/account/billing?checkout=done&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/account/billing`,
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
    return_url: `${await appOrigin()}/account/billing`,
  });
  redirect(session.url);
}

export type DeleteState = { error?: string } | null;

/**
 * Deletes the signed-in account for good: stops Pro at the end of the paid period, removes
 * every row the account owns, then deletes the Clerk user. Needs the word DELETE typed in.
 */
export async function deleteAccountAction(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  if (String(form.get("confirm") ?? "").trim() !== "DELETE") return { error: "Type DELETE to confirm." };
  const { user, store, account } = await requireUser();
  const cfg = paymentsConfig();
  const live = account.plan === "pro" && account.stripeSubscriptionId && cfg.mode !== "off" ? account.stripeSubscriptionId : null;
  const result = await deleteAccount({
    subscriptionId: live,
    cancelSubscription: async (id) => {
      await stripePost(cfg, `subscriptions/${encodeURIComponent(id)}`, { cancel_at_period_end: true });
    },
    deleteRows: () => store.deleteAccount(user.id),
    deleteAuthUser: () => deleteAuthUser(user.id),
  });
  if (!result.ok) return { error: result.error };
  console.log(JSON.stringify({ event: "account_deleted", authDeleted: result.authDeleted }));
  redirect(`${SITE_URL}/`);
}
