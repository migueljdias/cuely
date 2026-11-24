import type { Metadata } from "next";
import { Check } from "lucide-react";
import { checkoutOpen, paymentsConfig } from "@/billing/stripe";
import { PLANS } from "@/plans";
import { SITE_URL } from "@/site";
import { accountSession, day } from "../_session";
import { checkoutAction, portalAction } from "../actions";

export const metadata: Metadata = { title: "Plan & billing · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { account, plan } = await accountSession();
  const payments = paymentsConfig();
  const canCheckout = checkoutOpen(payments);
  const { checkout } = await searchParams;

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
      {checkout === "done" && (
        <p className="notice" role="status">
          Thanks. Your plan updates as soon as Stripe confirms the payment, usually within a few seconds.
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
            {plan.maxKeys === 1 ? "" : "s"}, {plan.maxStacks} saved stacks
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
