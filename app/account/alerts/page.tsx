import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { ToolLogo } from "../../_components/tool-logo";
import { plain } from "../_options";
import { day, projectsOverview } from "../_session";
import { markSeenAction } from "../stacks/actions";

export const metadata: Metadata = { title: "Alerts · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Every change across the holder's projects since each was last marked seen, by project. */
export default async function AlertsPage() {
  const { projects, alertCount } = await projectsOverview();
  const withChanges = projects.filter((p) => p.changes.length);

  return (
    <div className="account">
      <div className="app-section">
        <h1 className="app-h1">Alerts</h1>
        <p className="app-lede">
          What changed for the tools in your projects since you last looked: prices, free plans, measured health and
          compliance answers, each read from the vendor&apos;s own pages.
        </p>
      </div>

      {withChanges.length ? (
        withChanges.map(({ stack, changes }) => (
          <section key={stack.id} className="panel" aria-labelledby={`alerts-${stack.id}`}>
            <div className="card-head">
              <h2 id={`alerts-${stack.id}`}>
                <Link href={`/account/stacks/${stack.id}`}>{stack.name}</Link>
              </h2>
              <span className="muted small">Since {day(stack.seenAt)}</span>
            </div>
            <ul className="change-list">
              {changes.map((c, i) => (
                <li key={i} className={`is-${c.tone}`}>
                  <ToolLogo slug={c.tool} name={c.name} size={20} />
                  <span>
                    <strong>{c.name}</strong> {plain(c.text)}
                  </span>
                </li>
              ))}
            </ul>
            <form action={markSeenAction}>
              <input type="hidden" name="id" value={stack.id} />
              <button type="submit" className="btn-app btn-app-small">
                Mark as seen
              </button>
            </form>
          </section>
        ))
      ) : (
        <div className="empty">
          <Bell size={20} strokeWidth={1.6} aria-hidden="true" />
          <p>
            {projects.length
              ? "No changes since you last looked. Cuely re-reads vendor pages every few days and measures outages daily."
              : "Add a project and Cuely will flag changes to its tools here."}
          </p>
          {!projects.length && (
            <Link className="btn-app btn-app-small" href="/account/stacks">
              Add a project
            </Link>
          )}
        </div>
      )}
      {alertCount > 0 && <p className="muted small">{alertCount} open in total.</p>}
    </div>
  );
}
