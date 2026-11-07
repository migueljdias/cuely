import type { Metadata } from "next";
import { paymentsConfig } from "@/billing/stripe";
import { PLANS } from "@/plans";
import { SiteFooter, SiteHeader } from "../_components/chrome";

export const metadata: Metadata = {
  title: "Pricing · Cuely",
  description: "Cuely is free for solo builders, with no account needed. Pro adds higher limits for teams. Every plan gets the same answers.",
  alternates: { canonical: "/pricing" },
};

export default function Pricing() {
  const payments = paymentsConfig();
  const plans = [PLANS.anonymous, PLANS.free, PLANS.pro];
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap pricing">
        <h1 className="page-title">Free for builders. Pro for teams</h1>
        <p className="page-lede">
          Every plan gets the same recommendations, recipes and reasons. Paying changes your limits, never the answer,
          and no vendor can pay to be picked.
        </p>

        <div className="plan-table" role="list">
          {plans.map((p) => (
            <section key={p.id} className="plan" role="listitem" aria-labelledby={`plan-${p.id}`}>
              <h2 id={`plan-${p.id}`}>{p.name}</h2>
              <p className="plan-price">
                {p.priceLabel}
                {p.id === "pro" && payments.mode !== "live" && (
                  <span className="tag">{payments.mode === "test" ? "Test mode" : "Not on sale yet"}</span>
                )}
              </p>
              <p className="plan-summary">{p.summary}</p>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {p.id === "anonymous" && (
                <a className="btn btn-quiet" href="/#connect">
                  Connect your agent
                </a>
              )}
              {p.id === "free" && (
                <a className="btn btn-quiet" href="/auth/sign-up">
                  Create a free account
                </a>
              )}
              {p.id === "pro" &&
                (payments.mode === "off" ? (
                  <p className="muted small">Pro opens once teams need it. Free has no catch in the meantime.</p>
                ) : (
                  <a className="btn btn-primary" href="/account">
                    Upgrade from your account
                  </a>
                ))}
            </section>
          ))}
        </div>

        <p className="pricing-note">
          Prices are in US dollars. Stripe handles every payment; Cuely never sees or stores your card.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
