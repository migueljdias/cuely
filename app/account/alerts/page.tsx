import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { ALERT_TYPES, type AlertType } from "@/accounts/alerts";
import { SITE_URL } from "@/site";
import { plain } from "../_options";
import { accountSession, day, projectsOverview } from "../_session";
import { markToolSeenAction } from "../projects/actions";

export const metadata: Metadata = { title: "Alerts · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

const KIND_TONE: Record<AlertType, string> = { compliance: "warn", outages: "warn", price: "info", better: "good" };

/** Every alert across the holder's projects, filtered by type through ?type= so a view can be linked. */
export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const [{ user }, { projects, alerts }] = await Promise.all([accountSession(), projectsOverview()]);
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
            <span className="badge">Soon</span>
          </div>
          <p className="card-sub">For now, alerts show here and on Home. Email is on the way:</p>
          <ul className="deliver-list">
            <li>
              <input type="checkbox" disabled aria-label="Weekly digest email (coming soon)" />
              <span>
                <strong>Weekly digest email</strong>
                <span>Mondays, one email for all projects. Skipped when nothing changed.</span>
              </span>
            </li>
            <li>
              <input type="checkbox" disabled aria-label="Right away for launch blockers (coming soon)" />
              <span>
                <strong>Right away for launch blockers</strong>
                <span>A compliance &ldquo;no&rdquo; or a tool that stops fitting your data.</span>
              </span>
            </li>
            <li>
              <input type="checkbox" disabled aria-label="Price changes (coming soon)" />
              <span>
                <strong>Price changes</strong>
                <span>Free plan or paid price moves on any tool you use.</span>
              </span>
            </li>
          </ul>
          <p className="deliver-foot">
            Will go to {user.email ?? "your account email"} · manage email in <Link href="/account/settings">Settings</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
