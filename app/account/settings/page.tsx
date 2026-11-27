import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/site";
import { Avatar } from "../_avatar";
import { accountSession, projectsOverview } from "../_session";
import { productUpdatesAction } from "../actions";
import { DeleteAccount } from "./_delete-account";
import { ThemePicker } from "./_theme-picker";

export const metadata: Metadata = { title: "Settings · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ updates?: string }> }) {
  const [{ user, store, account, plan }, { projects }] = await Promise.all([accountSession(), projectsOverview()]);
  const { updates } = await searchParams;
  const [keys, usage] = await Promise.all([store ? store.listKeys(user.id) : [], store ? store.usage(user.id, 400) : []]);
  const label = user.name || user.email || "You";
  const deleteMail = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Delete my Cuely account")}&body=${encodeURIComponent(
    "Please delete my Cuely account and everything it holds. I'm writing from the email on the account.",
  )}`;

  return (
    <div className="settings">
      <h1 className="app-h1">Settings</h1>

      <div className="settings-grid">
        <div className="settings-col">
          <section className="card profile-card" aria-labelledby="h-profile">
            <Avatar className="profile-avatar" imageUrl={user.imageUrl} label={label} />
            <div>
              <h2 id="h-profile">{label}</h2>
              <p className="muted">{user.email}</p>
            </div>
            <Link className="btn-app btn-app-small" href="/account/profile">
              Edit profile
            </Link>
          </section>

          <section className="card" aria-labelledby="h-look">
            <h2 id="h-look" className="card-title">
              Appearance
            </h2>
            <p className="card-sub">Saved to your account, so it follows you to every browser.</p>
            {account ? <ThemePicker initial={account.theme} /> : <p className="muted">Needs the account database.</p>}
          </section>

          <section className="card" aria-labelledby="h-email">
            <h2 id="h-email" className="card-title">
              Email
            </h2>
            <ul className="deliver-list settings-email">
              <li>
                <span>
                  <strong>Alerts for my projects</strong>
                  <span>
                    {account && (account.alerts.digest || account.alerts.blockers || account.alerts.prices)
                      ? `On: ${[account.alerts.digest && "weekly digest", account.alerts.blockers && "launch blockers", account.alerts.prices && "price changes"].filter(Boolean).join(", ")}. `
                      : "Off. "}
                    Choose them on the <Link href="/account/alerts#h-deliver">Alerts</Link> page.
                  </span>
                </span>
              </li>
            </ul>
            {account && (
              <form action={productUpdatesAction} className="settings-optin">
                <label>
                  <input type="checkbox" name="product_updates" defaultChecked={account.productUpdates} />
                  <span>
                    <strong>Product updates</strong>
                    <span>A few emails a year when something big ships. Unsubscribe anytime.</span>
                  </span>
                </label>
                <button type="submit" className="btn-app btn-app-small">
                  Save
                </button>
              </form>
            )}
            {updates === "saved" && (
              <p className="muted small" role="status">
                Saved.
              </p>
            )}
            <p className="deliver-foot">Account and billing email always goes to {user.email}.</p>
          </section>
        </div>

        <div className="settings-col">
          <section className="card" aria-labelledby="h-data">
            <h2 id="h-data" className="card-title">
              What Cuely keeps
            </h2>
            <p className="card-sub">What your agent sends isn&apos;t stored. Only what you save here is.</p>
            <ul className="keeps">
              <li>
                <span>Projects: names, descriptions, tools, checklist ticks</span>
                <Link href="/account/projects">{projects.length}</Link>
              </li>
              <li>
                <span>API keys: a hash, the name and when it was last used</span>
                <Link href="/account/keys">{keys.length}</Link>
              </li>
              <li>
                <span>Usage: call counts per day, per Cuely tool and per key or app</span>
                <Link href="/account/usage">
                  {usage.length} day{usage.length === 1 ? "" : "s"}
                </Link>
              </li>
              <li>
                <span>Name, picture and sign-in: kept by Clerk</span>
                <Link href="/account/profile">Profile</Link>
              </li>
            </ul>
            <a className="btn-app btn-app-small" href="/account/data" download>
              Download my data
            </a>
            <p className="card-text muted small">
              More at <a href="https://cuely.dev/privacy">Privacy</a> and <a href="https://cuely.dev/trust">Trust</a>.
            </p>
          </section>

          <section className="card danger-card" aria-labelledby="h-danger">
            <h2 id="h-danger" className="card-title">
              Delete account
            </h2>
            <p className="card-sub">
              Removes your projects, keys and usage, and stops Pro from renewing. This can&apos;t be undone.
            </p>
            {account ? <DeleteAccount pro={plan.id === "pro"} /> : <a className="btn-app btn-app-small btn-app-danger" href={deleteMail}>Ask support to delete it</a>}
          </section>
        </div>
      </div>
    </div>
  );
}
