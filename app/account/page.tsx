import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccountStore } from "@/accounts/store";
import { authConfigured, currentUser } from "@/auth/server";
import { checkoutOpen, paymentsConfig } from "@/billing/stripe";
import { PLANS, planFor } from "@/plans";
import { SITE_URL } from "@/site";
import { NewKey } from "./_new-key";
import { LogOutItem } from "./_log-out";
import { AppShell } from "./_shell";
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
  const canCheckout = checkoutOpen(payments);
  const { checkout } = await searchParams;

  return (
    <AppShell email={user.email ?? ""} name={user.name} imageUrl={user.imageUrl} plan={plan.name} logOut={<LogOutItem />}>
      <div className="account">
        <div id="overview" className="app-section">
          <h1 className="app-title">Your account</h1>
          <p className="app-lede">Signed in as {user.email}</p>
          <div className="app-stats">
            <a className="app-stat" href="#usage">
              <span className="app-stat-label">Tool calls today</span>
              <span className="app-stat-value">
                {today.toLocaleString("en-US")}
                <small> / {plan.perDay.toLocaleString("en-US")}</small>
              </span>
              <span className="app-meter" aria-hidden="true">
                <i style={{ width: `${Math.min(100, (today / plan.perDay) * 100)}%` }} />
              </span>
            </a>
            <a className="app-stat" href="#keys">
              <span className="app-stat-label">Active API keys</span>
              <span className="app-stat-value">
                {keys.length}
                <small> / {plan.maxKeys}</small>
              </span>
              <span className="app-meter" aria-hidden="true">
                <i style={{ width: `${Math.min(100, (keys.length / plan.maxKeys) * 100)}%` }} />
              </span>
            </a>
            <a className="app-stat" href="#plan">
              <span className="app-stat-label">Plan</span>
              <span className="app-stat-value">{plan.name}</span>
              <span className="app-stat-note">{plan.perMinute} requests a minute</span>
            </a>
          </div>
        </div>

        {checkout === "soon" && (
          <p className="notice" role="status">
            Thanks for choosing Pro. Upgrades are being switched on right now, so you can&apos;t check out just yet. Your
            Free plan keeps working with the same answers, and this button will take you straight to checkout once
            it&apos;s ready.
          </p>
        )}

        {checkout === "done" && (
          <p className="notice" role="status">
            Thanks. Your plan updates as soon as Stripe confirms the payment, usually within a few seconds.
          </p>
        )}

        <section id="plan" className="panel" aria-labelledby="plan-title">
          <div className="panel-head">
            <h2 id="plan-title">
              {plan.name} plan
              {payments.mode === "test" && canCheckout && <span className="tag">Test mode</span>}
            </h2>
            <p className="muted">
              {plan.perDay.toLocaleString("en-US")} tool calls a day, {plan.perMinute} requests a minute
            </p>
          </div>
          <p>
            Every plan gets the same recommendations. Plans change limits, never answers.
            {account?.currentPeriodEnd && plan.id === "pro" && <> Renews {day(account.currentPeriodEnd)}.</>}
          </p>
          {plan.id === "pro" ? (
            payments.mode !== "off" && account?.stripeCustomerId ? (
              <form action={portalAction}>
                <button type="submit" className="btn btn-quiet">
                  Manage billing
                </button>
              </form>
            ) : null
          ) : (
            <div className="upgrade">
              <h3>
                Pro, {PLANS.pro.priceLabel}
              </h3>
              <ul>
                {PLANS.pro.features.slice(1).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <form action={checkoutAction}>
                <button type="submit" className="btn btn-primary">
                  Upgrade to Pro
                </button>
              </form>
            </div>
          )}
        </section>

        <section id="usage" className="panel" aria-labelledby="usage-title">
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

        <section id="keys" className="panel" aria-labelledby="keys-title">
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
          <p className="muted small">
            Create a key and the setup for Claude Code, Cursor and VS Code appears here with it filled in. Lost a key?
            Revoke it and make a new one. Step-by-step help: <a href={`${SITE_URL}/start`}>Get started</a>.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
