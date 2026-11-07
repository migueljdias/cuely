import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccountStore } from "@/accounts/store";
import { authConfigured, currentUser } from "@/auth/server";
import { paymentsConfig } from "@/billing/stripe";
import { ENDPOINT } from "@/connect";
import { PLANS, planFor } from "@/plans";
import { SiteFooter, SiteHeader } from "../_components/chrome";
import { NewKey } from "./_new-key";
import { checkoutAction, portalAction, revokeKeyAction } from "./actions";

export const metadata: Metadata = { title: "Account · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";


function day(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "never";
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  if (!authConfigured()) redirect("/sign-in");
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const store = await getAccountStore();
  const account = store ? await store.ensure(user.id, user.email) : null;
  const keys = store ? await store.listKeys(user.id) : [];
  const usage = store ? await store.usage(user.id, 14) : [];
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = Math.min(usage.find((u) => u.day === todayIso)?.calls ?? 0, planFor(account?.plan).perDay);
  const plan = planFor(account?.plan);
  const payments = paymentsConfig();
  const { checkout } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap account">
        <h1 className="page-title">Your account</h1>
        <p className="page-lede">Signed in as {user.email}</p>

        {checkout === "done" && (
          <p className="notice" role="status">
            Thanks. Your plan updates as soon as Stripe confirms the payment, usually within a few seconds.
          </p>
        )}

        <section className="panel" aria-labelledby="plan-title">
          <div className="panel-head">
            <h2 id="plan-title">
              {plan.name} plan
              {payments.mode === "test" && <span className="tag">Test mode</span>}
            </h2>
            <p className="muted">
              {plan.perDay.toLocaleString("en-US")} tool calls a day, {plan.perMinute} requests a minute
            </p>
          </div>
          <p>
            Every plan gets the same recommendations. Plans change limits, never answers.
            {account?.currentPeriodEnd && plan.id === "pro" && <> Renews {day(account.currentPeriodEnd)}.</>}
          </p>
          {payments.mode === "off" ? (
            <p className="muted">Pro isn&apos;t on sale yet. Free covers everything a solo builder needs.</p>
          ) : plan.id === "pro" ? (
            <form action={portalAction}>
              <button type="submit" className="btn btn-quiet">
                Manage billing
              </button>
            </form>
          ) : (
            <form action={checkoutAction}>
              <button type="submit" className="btn btn-primary">
                Upgrade to Pro, {PLANS.pro.priceLabel}
              </button>
            </form>
          )}
        </section>

        <section className="panel" aria-labelledby="usage-title">
          <div className="panel-head">
            <h2 id="usage-title">Usage</h2>
            <p className="muted">Counted for your whole account. Days reset at 00:00 UTC.</p>
          </div>
          <p>
            Today: <strong>{today.toLocaleString("en-US")}</strong> of {plan.perDay.toLocaleString("en-US")} tool calls.
          </p>
          {plan.id === "pro" && usage.length > 0 && (
            <ul className="key-list">
              {usage.map((u) => (
                <li key={u.day}>
                  <span>{day(`${u.day}T12:00:00Z`)}</span>
                  <span className="muted">{u.calls.toLocaleString("en-US")} calls</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="keys-title">
          <div className="panel-head">
            <h2 id="keys-title">API keys</h2>
            <p className="muted">
              For Cursor, VS Code, Claude Code and scripts. The Claude app signs in on its own and needs no key.{" "}
              {plan.id === "free" ? "Free includes one key." : `Pro includes up to ${plan.maxKeys}.`}
            </p>
          </div>
          {keys.length > 0 && (
            <ul className="key-list">
              {keys.map((k) => (
                <li key={k.id}>
                  <div>
                    <code>{k.prefix}…</code>
                    <span className="key-name">{k.name}</span>
                  </div>
                  <span className="muted">Last used {day(k.lastUsedAt)}</span>
                  <form action={revokeKeyAction}>
                    <input type="hidden" name="id" value={k.id} />
                    <button type="submit" className="btn btn-quiet btn-small">
                      Revoke
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <NewKey />
          <p className="muted small">Add it to Claude Code (or see cuely.dev for Cursor and VS Code):</p>
          <pre className="snippet">
            <code>{`claude mcp add --transport http cuely ${ENDPOINT} \\\n  --header "Authorization: Bearer YOUR_KEY"`}</code>
          </pre>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
