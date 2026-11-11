import type { Metadata } from "next";
import { checkoutOpen, paymentsConfig } from "@/billing/stripe";
import { PLANS } from "@/plans";
import { APP_URL } from "@/site";
import { SiteFooter, SiteHeader } from "../_components/chrome";

export const metadata: Metadata = {
  title: "Pricing · Cuely",
  description: "Cuely is free for solo builders with a quick sign-in. Pro adds higher limits for teams. Every plan gets the same answers.",
  alternates: { canonical: "/pricing" },
};

export default function Pricing() {
  const payments = paymentsConfig();
  const canCheckout = checkoutOpen(payments);
  const plans = [PLANS.free, PLANS.pro];
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap pricing">
        <h1 className="page-title">Free for builders. Pro for teams</h1>
        <p className="page-lede">
          Every plan gets the same recommendations, recipes and reasons. Paying changes your limits, never the answer,
          and no vendor can pay to be picked.
        </p>
        <p className="page-lede">
          Anyone can browse Cuely&apos;s recipes and catalog on this site. The MCP server, which your agent calls, needs a
          free account: Claude signs you in when you connect, and other tools use a free API key.
        </p>

        <div className="plan-table" role="list">
          {plans.map((p) => (
            <section key={p.id} className="plan" role="listitem" aria-labelledby={`plan-${p.id}`}>
              <h2 id={`plan-${p.id}`}>{p.name}</h2>
              <p className="plan-price">
                {p.priceLabel}
                {p.id === "pro" && payments.mode === "test" && canCheckout && <span className="tag">Test mode</span>}
              </p>
              <p className="plan-summary">{p.summary}</p>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {p.id === "free" && (
                <a className="btn btn-quiet" href={`${APP_URL}/sign-up`}>
                  Create a free account
                </a>
              )}
              {p.id === "pro" && (
                <a className="btn btn-primary" href={`${APP_URL}/account`}>
                  Upgrade to Pro
                </a>
              )}
            </section>
          ))}
        </div>

        <p className="pricing-note">
          Limits are per account, across all its keys. A tool call is one question your agent asks Cuely; connecting
          and listing tools don&apos;t count. Days reset at 00:00 UTC. Prices are in US dollars. Stripe handles every payment; Cuely never sees or stores your card.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
