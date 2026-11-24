import Link from "next/link";
import { ArrowRight, Check, GitCompareArrows, Layers, Rocket, Stethoscope } from "lucide-react";
import { stackChanges } from "@/accounts/stacks";
import { getRepository } from "@/repo";
import { SITE_URL } from "@/site";
import { ToolLogo } from "../_components/tool-logo";
import { plain } from "./_options";
import { accountSession } from "./_session";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("en-US");

export default async function OverviewPage() {
  const { user, store, stacks: stackStore, plan } = await accountSession();
  const [keys, usage, stacks, snap] = await Promise.all([
    store ? store.listKeys(user.id) : [],
    store ? store.usage(user.id, 30) : [],
    stackStore ? stackStore.list(user.id) : [],
    getRepository().then((r) => r.snapshot()),
  ]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const today = Math.min(usage.find((u) => u.day === todayIso)?.calls ?? 0, plan.perDay);
  const everCalled = usage.some((u) => u.calls > 0);
  const keyUsed = keys.some((k) => k.lastUsedAt);

  const bySlug = new Map(snap.tools.map((t) => [t.slug, t]));
  const watched = stacks.map((s) => {
    const tools = s.tools.map((t) => bySlug.get(t)).filter((t) => t !== undefined);
    return { stack: s, tools, changes: stackChanges(s.baseline, tools) };
  });
  const changeCount = watched.reduce((sum, w) => sum + w.changes.length, 0);

  // Tools whose measured signals are pulling their score down right now, yours first.
  const mine = new Set(stacks.flatMap((s) => s.tools));
  const troubled = snap.tools
    .filter((t) => (t.health?.score ?? 0) < 0 && (mine.size === 0 || mine.has(t.slug)))
    .sort((a, b) => a.health!.score - b.health!.score)
    .slice(0, mine.size ? 8 : 3);
  const lastRead = snap.tools.reduce((max, t) => (t.verifiedOn > max ? t.verifiedOn : max), "");

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
      done: stacks.length > 0,
      title: "Save a stack to watch",
      text: "Cuely tells you here when a price, free plan, outage record or compliance answer changes.",
      href: "/account/stacks",
      cta: "Save a stack",
    },
  ];
  const doneSteps = steps.filter((s) => s.done).length;
  const first = user.name?.split(" ")[0];

  return (
    <div className="account">
      <div className="app-section">
        <h1 className="app-title">{first ? `Welcome back, ${first}` : "Welcome back"}</h1>
        <p className="app-lede">Plan a build, check the stack you have, and keep an eye on the tools you depend on.</p>
        <div className="app-stats">
          <Link className="app-stat" href="/account/usage">
            <span className="app-stat-label">Tool calls today</span>
            <span className="app-stat-value">
              {n(today)}
              <small> / {n(plan.perDay)}</small>
            </span>
            <span className="app-meter" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (today / plan.perDay) * 100)}%` }} />
            </span>
          </Link>
          <Link className="app-stat" href="/account/stacks">
            <span className="app-stat-label">Saved stacks</span>
            <span className="app-stat-value">
              {stacks.length}
              <small> / {plan.maxStacks}</small>
            </span>
            <span className="app-stat-note">
              {changeCount ? `${changeCount} change${changeCount === 1 ? "" : "s"} since you last looked` : stacks.length ? "No changes since you last looked" : "Save one to get change alerts"}
            </span>
          </Link>
          <Link className="app-stat" href="/account/keys">
            <span className="app-stat-label">Active API keys</span>
            <span className="app-stat-value">
              {keys.length}
              <small> / {plan.maxKeys}</small>
            </span>
            <span className="app-stat-note">{plan.name} plan</span>
          </Link>
        </div>
      </div>

      {doneSteps < steps.length && (
        <section className="panel" aria-labelledby="setup-title">
          <div className="panel-head">
            <h2 id="setup-title">Get set up</h2>
            <p className="muted">
              {doneSteps} of {steps.length} done
            </p>
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
                  <Link className="btn btn-quiet btn-small" href={s.href}>
                    {s.cta}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="panel" aria-labelledby="ask-title">
        <div className="panel-head">
          <h2 id="ask-title">Ask Cuely</h2>
          <p className="muted">The same answers your agent gets, right here in the browser.</p>
        </div>
        <div className="quick-grid">
          <Link className="quick" href="/account/ask?mode=start">
            <Rocket size={18} strokeWidth={1.8} aria-hidden="true" />
            <strong>Plan a new build</strong>
            <span>Stack, monthly cost and the security checklist.</span>
          </Link>
          <Link className="quick" href="/account/ask?mode=check">
            <Stethoscope size={18} strokeWidth={1.8} aria-hidden="true" />
            <strong>Check my stack</strong>
            <span>Keep or change each tool, and what&apos;s missing.</span>
          </Link>
          <Link className="quick" href="/account/ask?mode=compare">
            <GitCompareArrows size={18} strokeWidth={1.8} aria-hidden="true" />
            <strong>Compare two tools</strong>
            <span>Free plans, prices and a verdict for your case.</span>
          </Link>
        </div>
      </section>

      <section className="panel" aria-labelledby="watch-title">
        <div className="panel-head">
          <h2 id="watch-title">Watching</h2>
          <p className="muted">
            Vendor pages last read {lastRead}. Prices are re-read every few days and outages measured daily.
          </p>
        </div>
        {watched.length ? (
          <ul className="row-list">
            {watched.map(({ stack, tools, changes }) => (
              <li key={stack.id}>
                <Link href={`/account/stacks/${stack.id}`} className="row-link">
                  <span className="logo-stack" aria-hidden="true">
                    {tools.slice(0, 5).map((t) => (
                      <ToolLogo key={t.slug} slug={t.slug} name={t.name} size={22} />
                    ))}
                  </span>
                  <span className="row-main">
                    <strong>{stack.name}</strong>
                    <span className="muted small">
                      {tools.length} tool{tools.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  {changes.length ? (
                    <span className={`badge ${changes.some((c) => c.tone === "worse") ? "badge-warn" : "badge-info"}`}>
                      {changes.length} change{changes.length === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="badge">Up to date</span>
                  )}
                  <ArrowRight size={16} aria-hidden="true" className="row-arrow" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <Layers size={20} strokeWidth={1.6} aria-hidden="true" />
            <p>
              Save the tools a project uses and Cuely will flag price changes, new free-plan limits, outages and
              compliance answers here.
            </p>
            <Link className="btn btn-quiet btn-small" href="/account/stacks">
              Save a stack
            </Link>
          </div>
        )}

        {troubled.length > 0 && (
          <>
            <h3 className="sub-head">{mine.size ? "Measured problems in your stacks" : "Measured problems right now"}</h3>
            <ul className="row-list">
              {troubled.map((t) => (
                <li key={t.slug}>
                  <a href={`${SITE_URL}/tools/${t.slug}`} className="row-link">
                    <ToolLogo slug={t.slug} name={t.name} size={22} />
                    <span className="row-main">
                      <strong>
                        {t.name}
                      </strong>
                      <span className="muted small">{plain(t.health!.reasons.join(" "))}</span>
                    </span>
                    <span className="badge badge-warn">{t.health!.score}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
