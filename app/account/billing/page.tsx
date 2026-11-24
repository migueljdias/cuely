import type { Metadata } from "next";
import { Check } from "lucide-react";
import { redirect } from "next/navigation";
import { checkoutOpen, paymentsConfig } from "@/billing/stripe";
import { syncCheckoutSession } from "@/billing/sync";
import { PLANS } from "@/plans";
import { SITE_URL } from "@/site";
import { accountSession, day } from "../_session";
import { checkoutAction, portalAction } from "../actions";

export const metadata: Metadata = { title: "Plan & billing · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; session_id?: string }> }) {
  const { user, store, account, plan } = await accountSession();
  const payments = paymentsConfig();
  const canCheckout = checkoutOpen(payments);
  const { checkout, session_id } = await searchParams;

  // Back from Stripe: apply the subscription now rather than waiting for the webhook.
  if (checkout === "done" && session_id && store) {
    try {
      await syncCheckoutSession(payments, store, user.id, session_id);
    } catch (err) {
      console.warn(JSON.stringify({ event: "checkout_sync_failed", account: user.id, reason: err instanceof Error ? err.message : String(err) }));
    }
    redirect("/account/billing?checkout=done");
  }

  return (
    <div className="account">
      <div className="app-section">
        <h1 className="app-title">Plan &amp; billing</h1>
        <p className="app-lede">Every plan gets the same recommendations. Plans change limits, never answers.</p>
      </div>

      {checkout === "soon" && (
        <p className="notice" role="status">
          Thanks for choosing Pro. Upgrades are being switched on right now, so you can&apos;t check out just yet. Your Free
          plan keeps working with the same answers, and this button will take you straight to checkout once it&apos;s ready.
        </p>
      )}
      {checkout === "unavailable" && (
        <p className="notice" role="alert">
          Checkout couldn&apos;t start just now, and you weren&apos;t charged. The reason has been logged so it can be fixed.
          Please try again later, or write to support.
        </p>
      )}
      {checkout === "done" && (
        <p className="notice" role="status">
          {plan.id === "pro"
            ? "Thanks, you're on Pro. Your new limits apply right away."
            : "Thanks. Your plan updates as soon as Stripe confirms the payment, usually within a few seconds."}
        </p>
      )}

      <section className="panel" aria-labelledby="plan-title">
        <div className="panel-head">
          <h2 id="plan-title">
            {plan.name} plan
            {payments.mode === "test" && canCheckout && <span className="tag">Test mode</span>}
          </h2>
          <p className="muted">
            {plan.perDay.toLocaleString("en-US")} tool calls a day, {plan.perMinute} requests a minute, {plan.maxKeys} API key
            {plan.maxKeys === 1 ? "" : "s"}, {plan.maxStacks} projects
            {account?.currentPeriodEnd && plan.id === "pro" && <>. Renews {day(account.currentPeriodEnd)}</>}
          </p>
        </div>
        {plan.id === "pro" ? (
          payments.mode !== "off" && account?.stripeCustomerId ? (
            <>
              <p>Cards, invoices and cancelling are in Stripe&apos;s billing portal.</p>
              <form action={portalAction}>
                <button type="submit" className="btn btn-quiet">
                  Manage billing
                </button>
              </form>
            </>
          ) : null
        ) : (
          <div className="plan-compare">
            {[PLANS.free, PLANS.pro].map((p) => (
              <div key={p.id} className={`plan-card${p.id === plan.id ? " is-current" : ""}`}>
                <h3>
                  {p.name} <span className="muted">{p.priceLabel}</span>
                </h3>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>
                      <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                {p.id === plan.id ? (
                  <span className="badge">Your plan</span>
                ) : (
                  <form action={checkoutAction}>
                    <button type="submit" className="btn btn-primary">
                      Upgrade to Pro
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="muted small">
          Details and the full comparison: <a href={`${SITE_URL}/pricing`}>Pricing</a>.
        </p>
      </section>
    </div>
  );
}
