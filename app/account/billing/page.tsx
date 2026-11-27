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
  const canManage = payments.mode !== "off" && Boolean(account?.stripeCustomerId);

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
    <div className="billing-page">
      <div>
        <h1 className="app-h1">Plan &amp; billing</h1>
        <p className="project-desc">Every plan gets the same recommendations. Plans change limits, never answers.</p>
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

      <div className="billing-grid">
        <div className="billing-main">
          <section className="card current-plan" aria-labelledby="h-current">
            <div>
              <p className="add-kicker">
                Current plan {payments.mode === "test" && canCheckout && <span className="badge">Test mode</span>}
              </p>
              <h2 id="h-current">
                {plan.name} · {plan.priceLabel}
              </h2>
              <p className="muted">
                {plan.id === "pro" && account?.currentPeriodEnd
                  ? `Renews ${day(account.currentPeriodEnd)}`
                  : `${plan.perDay.toLocaleString("en-US")} tool calls a day, ${plan.maxKeys} API key${plan.maxKeys === 1 ? "" : "s"}, ${plan.maxStacks} projects`}
              </p>
            </div>
            {canManage ? (
              <form action={portalAction}>
                <button type="submit" className="btn-app">
                  Manage billing
                </button>
              </form>
            ) : plan.id === "free" ? (
              <form action={checkoutAction}>
                <button type="submit" className="btn-app btn-app-primary">
                  Upgrade to Pro
                </button>
              </form>
            ) : null}
          </section>

          <section className="plan-pair" aria-label="Compare plans">
            {[PLANS.free, PLANS.pro].map((p) => (
              <div key={p.id} className={`card plan-tile${p.id === "pro" ? " is-pro" : ""}`}>
                <h3>
                  {p.name} <span>{p.priceLabel}</span>
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
                  <span className="badge badge-info plan-tile-foot">Your plan</span>
                ) : p.id === "pro" ? (
                  <form action={checkoutAction} className="plan-tile-foot">
                    <button type="submit" className="btn-app btn-app-primary btn-app-small">
                      Upgrade to Pro
                    </button>
                  </form>
                ) : (
                  <span className="muted small plan-tile-foot">Cancel anytime in the billing portal; Free applies when the period ends.</span>
                )}
              </div>
            ))}
          </section>
          <p className="muted small">
            Details and the full comparison: <a href={`${SITE_URL}/pricing`}>Pricing</a>.
          </p>
        </div>

        <aside className="card" aria-labelledby="h-invoices">
          <h2 id="h-invoices" className="card-title">
            Invoices
          </h2>
          {canManage ? (
            <>
              <p className="card-sub">Invoices, receipts, your card and cancelling are all in Stripe&apos;s billing portal.</p>
              <form action={portalAction}>
                <button type="submit" className="btn-app btn-app-small">
                  Open billing portal
                </button>
              </form>
            </>
          ) : (
            <p className="card-sub">No invoices yet. They&apos;ll be in Stripe&apos;s billing portal once you subscribe.</p>
          )}
          <p className="card-text muted small">Payments are handled by Stripe. Cuely never sees or stores card details.</p>
        </aside>
      </div>
    </div>
  );
}
