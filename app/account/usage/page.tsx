import type { Metadata } from "next";
import Link from "next/link";
import type { UsageDetail } from "@/accounts/store";
import { PLANS } from "@/plans";
import { accountSession, day } from "../_session";

export const metadata: Metadata = { title: "Usage · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("en-US");
const DAYS = 14;

/** Time until 00:00 UTC, in words. */
function untilReset(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const mins = Math.max(1, Math.round((next - now.getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  return h ? `${h} h ${mins % 60} min` : `${mins} min`;
}

/** Sums the detail rows by one field and turns them into shares of the total, biggest first. */
function shares(rows: UsageDetail[], by: (r: UsageDetail) => string) {
  const total = rows.reduce((s, r) => s + r.calls, 0);
  const sums = new Map<string, number>();
  for (const r of rows) sums.set(by(r), (sums.get(by(r)) ?? 0) + r.calls);
  return [...sums.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, calls]) => ({ key, calls, pct: total ? Math.round((calls / total) * 100) : 0 }));
}

export default async function UsagePage() {
  const { user, store, plan } = await accountSession();
  const [usage, detail, keys] = await Promise.all([
    store ? store.usage(user.id, DAYS) : [],
    store ? store.usageDetail(user.id, DAYS) : [],
    store ? store.listKeys(user.id) : [],
  ]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = Math.min(usage.find((u) => u.day === todayIso)?.calls ?? 0, plan.perDay);
  const pro = plan.id === "pro";

  // One bar per day, oldest first, with the days that had no calls filled in.
  const byDay = new Map(usage.map((u) => [u.day, u.calls]));
  const series = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(Date.now() - (DAYS - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day: d, calls: Math.min(byDay.get(d) ?? 0, plan.perDay) };
  });
  const peak = Math.max(...series.map((s) => s.calls));
  const busiest = series.find((s) => s.calls === peak && peak > 0);
  const total = series.reduce((sum, s) => sum + s.calls, 0);

  const keyName = new Map(keys.map((k) => [`key:${k.id}`, k.name]));
  const sourceLabel = (s: string) =>
    s === "connector"
      ? "Signed-in app, like the Claude app"
      : s === "ask"
        ? "Ask Cuely on this site"
        : s.startsWith("key:")
          ? keyName.has(s)
            ? `Key “${keyName.get(s)}”`
            : "A revoked key"
          : "Other";
  const byTool = shares(detail, (r) => r.tool);
  const bySource = shares(detail, (r) => r.source);

  return (
    <div className="usage-page">
      <div>
        <h1 className="app-h1">Usage</h1>
        <p className="project-desc">Counted for your whole account, across every key and connector. Days reset at 00:00 UTC.</p>
      </div>

      <section className="home-stats" aria-label="Today">
        <div className="stat-card">
          <span className="stat-label">Tool calls today</span>
          <span className="stat-value">
            {n(today)}
            <small> / {n(plan.perDay)}</small>
          </span>
          <span className="app-meter" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (today / plan.perDay) * 100)}%` }} />
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Left today</span>
          <span className="stat-value">{n(Math.max(0, plan.perDay - today))}</span>
          <span className="stat-note">Resets in {untilReset()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Last {DAYS} days</span>
          {pro ? (
            <>
              <span className="stat-value">{n(total)}</span>
              <span className="stat-note">{busiest ? `Busiest day: ${day(`${busiest.day}T12:00:00Z`)}, ${n(busiest.calls)} calls` : "No calls yet"}</span>
            </>
          ) : (
            <>
              <span className="stat-value is-muted">Pro</span>
              <span className="stat-note">Daily history comes with Pro</span>
            </>
          )}
        </div>
        <div className="stat-card">
          <span className="stat-label">Rate limit</span>
          <span className="stat-value">
            {plan.perMinute}
            <small> / minute</small>
          </span>
          <span className="stat-note">Every MCP request counts toward this</span>
        </div>
      </section>

      {pro ? (
        <div className="usage-grid">
          <section className="card" aria-labelledby="h-chart">
            <h2 id="h-chart" className="card-title">
              Tool calls per day
            </h2>
            <p className="card-sub">One tool call is one question your agent, or Ask Cuely, asks. Connecting and listing tools don&apos;t count.</p>
            <div className="day-bars" role="img" aria-label={`Tool calls per day for the last ${DAYS} days, peak ${n(peak)}`}>
              {series.map((s, i) => (
                <div key={s.day} className="day-bar" title={`${day(`${s.day}T12:00:00Z`)}: ${n(s.calls)} calls`}>
                  <span className="day-bar-n">{s.calls ? n(s.calls) : ""}</span>
                  <i className={i === series.length - 1 ? "is-today" : undefined} style={{ height: `${peak ? (s.calls / peak) * 100 : 0}%` }} />
                  <span className="day-bar-d">{Number(s.day.slice(8))}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="usage-side">
            <section className="card" aria-labelledby="h-by-tool">
              <h2 id="h-by-tool" className="card-title">
                By Cuely tool
              </h2>
              {byTool.length ? (
                <ul className="share-list">
                  {byTool.map((r) => (
                    <li key={r.key}>
                      <code>{r.key}</code>
                      <span>{r.pct}%</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="card-text muted">Shows up after your next tool calls.</p>
              )}
            </section>
            <section className="card" aria-labelledby="h-by-source">
              <h2 id="h-by-source" className="card-title">
                By key or app
              </h2>
              {bySource.length ? (
                <ul className="share-list">
                  {bySource.map((r) => (
                    <li key={r.key}>
                      <span>{sourceLabel(r.key)}</span>
                      <span>{r.pct}%</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="card-text muted">Shows up after your next tool calls.</p>
              )}
              <p className="card-text muted small">Counts only. What your agent asked is never stored.</p>
            </section>
          </div>
        </div>
      ) : (
        <div className="empty">
          <p>
            Daily history and the split by tool and by key are part of Pro, along with {n(PLANS.pro.perDay)} tool calls a
            day. Free shows today&apos;s count above.
          </p>
          <Link className="btn-app btn-app-small" href="/account/billing">
            See Pro
          </Link>
        </div>
      )}
    </div>
  );
}
