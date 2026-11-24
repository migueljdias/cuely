import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { ALERT_TYPES, type AlertType } from "@/accounts/alerts";
import { SITE_URL } from "@/site";
import { plain } from "../_options";
import { accountSession, day, projectsOverview } from "../_session";
import { emailConfigured } from "@/email/send";
import { alertPrefsAction } from "../actions";
import { markToolSeenAction } from "../projects/actions";

export const metadata: Metadata = { title: "Alerts · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

const KIND_TONE: Record<AlertType, string> = { compliance: "warn", outages: "warn", price: "info", better: "good" };

/** Every alert across the holder's projects, filtered by type through ?type= so a view can be linked. */
export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ type?: string; saved?: string }> }) {
  const { type, saved } = await searchParams;
  const [{ user, account }, { projects, alerts }] = await Promise.all([accountSession(), projectsOverview()]);
  const mailOn = emailConfigured();
  const filter = ALERT_TYPES.some((t) => t.id === type) ? (type as AlertType) : null;
  const shown = filter ? alerts.filter((a) => a.type === filter) : alerts;
  const tabs = [{ id: null, label: "All", count: alerts.length }, ...ALERT_TYPES.map((t) => ({ ...t, count: alerts.filter((a) => a.type === t.id).length }))];

  return (
    <div className="alerts-page">
      <div>
        <h1 className="app-h1">Alerts</h1>
        <p className="project-desc">
          What changed for the tools in your projects. Prices and compliance pages are re-read every few days; outages are
          measured daily.
        </p>
      </div>

      <div className="alerts-grid">
        <section className="alerts-main" aria-label="Alert list">
          <nav className="filter-tabs" aria-label="Filter alerts">
            {tabs.map((t) => {
              const on = t.id === filter;
              return (
                <Link
                  key={t.label}
                  href={t.id ? `/account/alerts?type=${t.id}` : "/account/alerts"}
                  className={`filter-tab${on ? " is-on" : ""}`}
                  aria-current={on ? "page" : undefined}
                  scroll={false}
                >
                  {t.label} · {t.count}
                </Link>
              );
            })}
          </nav>

          {shown.length ? (
            shown.map((a) => (
              <article key={a.key} className="alert-card">
                <span className={`alert-chip is-${KIND_TONE[a.type]}`}>{a.kind}</span>
                <div className="alert-body">
                  <h2>{a.toolName}</h2>
                  <p>{plain(a.text)}</p>
                  <p className="alert-meta">
                    {a.projects.map((p) => p.name).join(", ")} ·{" "}
                    {a.source === "measured" ? `measured ${a.measuredOn}` : `since you looked on ${day(a.projects[0].seenAt)}`}
                  </p>
                </div>
                <div className="alert-actions">
                  {a.projects.length === 1 ? (
                    <Link className="btn-app btn-app-small" href={`/account/projects/${a.projects[0].id}`}>
                      Open project
                    </Link>
                  ) : (
                    <a className="btn-app btn-app-small" href={`${SITE_URL}/tools/${a.tool}`}>
                      Tool page
                    </a>
                  )}
                  {a.source === "change" && (
                    <form action={markToolSeenAction}>
                      <input type="hidden" name="tool" value={a.tool} />
                      <input type="hidden" name="kind" value={a.changeKind} />
                      {a.projects.map((p) => (
                        <input key={p.id} type="hidden" name="id" value={p.id} />
                      ))}
                      <button type="submit" className="btn-app btn-app-small btn-app-quiet">
                        Mark seen
                      </button>
                    </form>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="empty">
              <Bell size={20} strokeWidth={1.6} aria-hidden="true" />
              <p>
                {!projects.length
                  ? "Add a project and Cuely will flag changes to its tools here."
                  : filter
                    ? "Nothing of this kind right now."
                    : "No changes since you last looked. Cuely re-reads vendor pages every few days and measures outages daily."}
              </p>
              {!projects.length && (
                <Link className="btn-app btn-app-small" href="/account/projects">
                  Add a project
                </Link>
              )}
            </div>
          )}
        </section>

        <aside className="card deliver-card" aria-labelledby="h-deliver">
          <div className="card-head">
            <h2 id="h-deliver">How you hear about them</h2>
            {!mailOn && <span className="badge">Soon</span>}
          </div>
          <p className="card-sub">
            {mailOn
              ? "Alerts always show here and on Home. Pick the emails you want; each is off until you turn it on."
              : "Alerts show here and on Home. Email isn't switched on yet: your choice is saved and applies once it is."}
          </p>
          {account ? (
            <form action={alertPrefsAction}>
              <ul className="deliver-list">
                <li>
                  <input id="al-digest" type="checkbox" name="digest" defaultChecked={account.alerts.digest} />
                  <label htmlFor="al-digest">
                    <strong>Weekly digest email</strong>
                    <span>Mondays, one email for all projects. Skipped when nothing changed.</span>
                  </label>
                </li>
                <li>
                  <input id="al-blockers" type="checkbox" name="blockers" defaultChecked={account.alerts.blockers} />
                  <label htmlFor="al-blockers">
                    <strong>Right away for launch blockers</strong>
                    <span>A compliance answer that changes for the worse, checked daily.</span>
                  </label>
                </li>
                <li>
                  <input id="al-prices" type="checkbox" name="prices" defaultChecked={account.alerts.prices} />
                  <label htmlFor="al-prices">
                    <strong>Price changes</strong>
                    <span>Free plan or paid price moves on any tool you use, checked daily.</span>
                  </label>
                </li>
              </ul>
              <div className="deliver-save">
                <button type="submit" className="btn-app btn-app-small">
                  Save
                </button>
                {saved && (
                  <span className="muted small" role="status">
                    Saved.
                  </span>
                )}
              </div>
            </form>
          ) : (
            <p className="muted">Needs the account database.</p>
          )}
          <p className="deliver-foot">
            Sent to {user.email ?? "your account email"}. Every email has a one-click unsubscribe.
          </p>
        </aside>
      </div>
    </div>
  );
}
