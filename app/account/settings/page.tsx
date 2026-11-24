import type { Metadata } from "next";
import Link from "next/link";
import { accountSession } from "../_session";
import { productUpdatesAction } from "../actions";

export const metadata: Metadata = { title: "Settings · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ updates?: string }> }) {
  const { user, account } = await accountSession();
  const { updates } = await searchParams;

  return (
    <div className="account">
      <div className="app-section">
        <h1 className="app-title">Settings</h1>
        <p className="app-lede">Email and what Cuely keeps about you.</p>
      </div>

      <section className="panel" aria-labelledby="email-title">
        <div className="panel-head">
          <h2 id="email-title">Email</h2>
          <p className="muted">Account and billing email always goes to {user.email}. Everything else is your call.</p>
        </div>
        {account && (
          <form action={productUpdatesAction} className="optin">
            <label>
              <input type="checkbox" name="product_updates" defaultChecked={account.productUpdates} />
              <span>
                <strong>Product updates</strong>
                <span className="muted"> A few emails a year when something big ships. Unsubscribe anytime.</span>
              </span>
            </label>
            <button type="submit" className="btn btn-quiet btn-small">
              Save
            </button>
          </form>
        )}
        {updates === "saved" && (
          <p className="muted small" role="status">
            Saved.
          </p>
        )}
      </section>

      <section className="panel" aria-labelledby="data-title">
        <div className="panel-head">
          <h2 id="data-title">Your data</h2>
          <p className="muted">What your account holds, and where to change it.</p>
        </div>
        <ul className="row-list">
          <li>
            <Link className="row-link" href="/account/profile">
              <span className="row-main">
                <strong>Name, picture, email addresses and password</strong>
                <span className="muted small">Kept by Clerk, which runs sign-in.</span>
              </span>
            </Link>
          </li>
          <li>
            <Link className="row-link" href="/account/stacks">
              <span className="row-main">
                <strong>Saved stacks</strong>
                <span className="muted small">Only the names, descriptions and tools you save. Delete any of them there.</span>
              </span>
            </Link>
          </li>
          <li>
            <Link className="row-link" href="/account/keys">
              <span className="row-main">
                <strong>API keys</strong>
                <span className="muted small">A hash of each key, its name and when it was last used.</span>
              </span>
            </Link>
          </li>
        </ul>
        <p className="muted small">
          What your agent sends Cuely isn&apos;t kept, and neither is what you type into Ask Cuely unless you save it as a
          stack. More at <a href="https://cuely.dev/privacy">Privacy</a> and <a href="https://cuely.dev/trust">Trust</a>.
        </p>
      </section>
    </div>
  );
}
