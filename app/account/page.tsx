import Link from "next/link";
import { Check, Layers } from "lucide-react";
import { buildAlerts } from "@/accounts/alerts";
import type { Tool } from "@/catalog";
import { SITE_URL } from "@/site";
import { ToolLogo } from "../_components/tool-logo";
import { Greeting } from "./_greeting";
import { plain } from "./_options";
import { accountSession, projectsOverview } from "./_session";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("en-US");
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;

/** What a tool costs a month at 1,000 users, when the catalog has worked it out. Staff-tool costs are left out. */
const monthlyAt1k = (t: Tool) => (t.cost && t.cost.scale !== "10_staff" ? t.cost.monthly : null);

export default async function HomePage() {
  const [{ user, store, plan }, { projects, alertCount, snap, lastRead, hasStore }] = await Promise.all([
    accountSession(),
    projectsOverview(),
  ]);
  const [keys, usage] = await Promise.all([store ? store.listKeys(user.id) : [], store ? store.usage(user.id, 30) : []]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const today = Math.min(usage.find((u) => u.day === todayIso)?.calls ?? 0, plan.perDay);
  const everCalled = usage.some((u) => u.calls > 0);
  const keyUsed = keys.some((k) => k.lastUsedAt);

  // Spend across projects: each tool counted once per project, only where the catalog has a figure.
  const priced = projects.flatMap((p) => p.tools.map(monthlyAt1k)).filter((v): v is number => v !== null);
  const spend = priced.reduce((sum, v) => sum + v, 0);
  const toolCount = projects.reduce((sum, p) => sum + p.tools.length, 0);

  // The alerts panel: the same alerts as the Alerts page, worst first.
  const feed = buildAlerts(projects)
    .slice(0, 5)
    .map((a) => ({
      key: a.key,
      tone: a.tone,
      label: `${a.kind} · ${a.toolName}`,
      text: plain(a.text),
      where: a.projects.map((p) => p.name).join(", "),
      href: a.source === "measured" ? `${SITE_URL}/tools/${a.tool}` : a.projects.length === 1 ? `/account/projects/${a.projects[0].id}` : "/account/alerts",
    }));

  // Launch checklists across projects; the card opens the project with the most left to do.
  const checksDone = projects.reduce((sum, p) => sum + p.ready.done, 0);
  const checksTotal = projects.reduce((sum, p) => sum + p.ready.total, 0);
  const blockers = projects.reduce((sum, p) => sum + p.ready.blockersLeft, 0);
  const mostLeft = [...projects].sort((a, b) => b.ready.total - b.ready.done - (a.ready.total - a.ready.done))[0];
  const checklistHref = mostLeft ? `/account/projects/${mostLeft.stack.id}#ready` : "/account/projects";

  const steps = [
    {
      done: keys.length > 0 || everCalled,
      title: "Get a key or connect Claude",
      text: "Claude signs in on its own. Cursor, VS Code and Claude Code use an API key.",
      href: "/account/keys",
      cta: "Create a key",
    },
    {
      done: keyUsed || everCalled,
      title: "Ask your agent something",
      text: "Try: “Use Cuely to choose the stack for what I'm building.”",
      href: "/account/keys#connect",
      cta: "Setup for your tool",
    },
    {
      done: projects.length > 0,
      title: "Save a project to watch",
      text: "Cuely tells you here when a price, free plan, outage record or compliance answer changes.",
      href: "/account/projects",
      cta: "Add a project",
    },
  ];
  const doneSteps = steps.filter((s) => s.done).length;
  const first = user.name?.split(" ")[0] ?? null;
  const readToday = lastRead === todayIso;

  return (
    <div className="home">
      <div className="home-head">
        <div>
          <p className="home-date">
            <Greeting part="date" />
            {lastRead && ` · vendor pages read ${readToday ? "today" : `on ${lastRead}`}`}
          </p>
          <h1 className="app-h1">
            <Greeting part="hello" name={first} />
          </h1>
        </div>
        <div className="home-actions">
          <Link className="btn-app btn-app-primary" href="/account/ask?mode=start">
            Plan a new project
          </Link>
        </div>
      </div>

      <section className="home-stats" aria-label="Summary">
        <Link className="stat-card" href="/account/projects">
          <span className="stat-label">Monthly spend, all projects</span>
          <span className="stat-value">
            {priced.length ? `$${n(spend)}` : "–"}
            <small> at 1k users</small>
          </span>
          {priced.length < toolCount && (
            <span className="stat-note">
              {plural(toolCount - priced.length, "tool")} without a figure in the catalog
            </span>
          )}
        </Link>
        <Link className="stat-card" href="/account/alerts">
          <span className="stat-label">Open alerts</span>
          <span className={`stat-value${alertCount ? " is-warn" : ""}`}>
            {n(alertCount)}
            <small>{alertCount ? " need a look" : " all clear"}</small>
          </span>
        </Link>
        <Link className="stat-card" href={checklistHref}>
          <span className="stat-label">Launch checklists</span>
          <span className="stat-value">
            {projects.length ? n(checksDone) : "–"}
            <small>{projects.length ? ` of ${n(checksTotal)} done` : " add a project"}</small>
          </span>
          {blockers > 0 && <span className="stat-note">{plural(blockers, "item")} blocking launch</span>}
        </Link>
        <Link className="stat-card" href="/account/usage">
          <span className="stat-label">Agent calls today</span>
          <span className="stat-value">
            {n(today)}
            <small> / {n(plan.perDay)}</small>
          </span>
        </Link>
      </section>

      {doneSteps < steps.length && (
        <section className="card" aria-labelledby="setup-title">
          <div className="card-head">
            <h2 id="setup-title">Get set up</h2>
            <span className="muted">
              {doneSteps} of {steps.length} done
            </span>
          </div>
          <ol className="steps-list">
            {steps.map((s) => (
              <li key={s.title} className={s.done ? "is-done" : undefined}>
                <span className="steps-dot" aria-hidden="true">
                  {s.done ? <Check size={14} strokeWidth={2.5} /> : null}
                </span>
                <div>
                  <strong>{s.title}</strong>
                  <span className="muted small">{s.text}</span>
                </div>
                {!s.done && (
                  <Link className="btn-app btn-app-small" href={s.href}>
                    {s.cta}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="home-grid">
        <section aria-labelledby="h-proj" className="home-main">
          <div className="section-head">
            <h2 id="h-proj">Projects</h2>
            <Link href="/account/projects">All projects</Link>
          </div>

          {!hasStore ? (
            <p className="notice" role="status">
              Projects need a database, and none is configured on this deployment.
            </p>
          ) : projects.length ? (
            <div className="project-grid">
              {projects.slice(0, 4).map(({ stack, tools, changes, ready }) => {
                const worse = changes.filter((c) => c.tone === "worse").length;
                const lead = changes.find((c) => c.tone === "worse") ?? changes[0];
                const cost = tools.map(monthlyAt1k).filter((v): v is number => v !== null);
                return (
                  <Link key={stack.id} href={`/account/projects/${stack.id}`} className="project-card">
                    <span className="project-card-top">
                      <span className="project-card-name">
                        <strong>{stack.name}</strong>
                        <span>
                          {plural(tools.length, "tool")}
                          {cost.length ? ` · $${n(cost.reduce((s, v) => s + v, 0))}/mo at 1k users` : ""}
                        </span>
                      </span>
                      {ready.blockersLeft ? (
                        <span className="badge badge-warn">{plural(ready.blockersLeft, "blocker")}</span>
                      ) : changes.length ? (
                        <span className={`badge ${worse ? "badge-warn" : "badge-info"}`}>{plural(changes.length, "change")}</span>
                      ) : (
                        <span className="badge badge-good">Up to date</span>
                      )}
                    </span>
                    <span className="project-card-text">
                      {lead
                        ? `${lead.name}: ${plain(lead.text)}`
                        : stack.description
                          ? stack.description
                          : "Nothing has changed for these tools since you last looked."}
                    </span>
                    {ready.total > 0 && (
                      <span className="ready-bar">
                        <span className="ready-bar-label">
                          <span>Launch readiness</span>
                          <span>{ready.pct}%</span>
                        </span>
                        <span className="app-meter" aria-hidden="true">
                          <i style={{ width: `${ready.pct}%` }} />
                        </span>
                      </span>
                    )}
                    <span className="logo-stack" aria-hidden="true">
                      {tools.slice(0, 8).map((t) => (
                        <ToolLogo key={t.slug} slug={t.slug} name={t.name} size={24} />
                      ))}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              <Layers size={20} strokeWidth={1.6} aria-hidden="true" />
              <p>
                Add the tools a project uses and Cuely will flag price changes, new free-plan limits, outages and
                compliance answers here.
              </p>
              <Link className="btn-app btn-app-small" href="/account/projects">
                Add a project
              </Link>
            </div>
          )}

          <div className="quick-grid">
            <Link className="quick" href="/account/ask?mode=start">
              <strong>Plan a new build</strong>
              <span>Stack, cost and checklist</span>
            </Link>
            <Link className="quick" href="/account/ask?mode=check">
              <strong>Check a stack</strong>
              <span>Keep, change or add</span>
            </Link>
            <Link className="quick" href="/account/ask?mode=compare">
              <strong>Compare two tools</strong>
              <span>A verdict for your case</span>
            </Link>
          </div>
        </section>

        <aside aria-labelledby="h-alerts" className="card home-alerts">
          <div className="section-head">
            <h2 id="h-alerts">Alerts</h2>
            <Link href="/account/alerts">View all</Link>
          </div>
          {feed.length ? (
            <ul className="alert-feed">
              {feed.map((a) => (
                <li key={a.key}>
                  <a href={a.href}>
                    <span className={`alert-kind is-${a.tone}`}>{a.label}</span>
                    <span className="alert-text">{a.text}</span>
                    {a.where && <span className="alert-where">{a.where}</span>}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted alert-empty">
              {projects.length
                ? "Nothing has changed in your projects since you last looked."
                : "Alerts show up here once you add a project."}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
