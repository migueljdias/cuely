import type { Metadata } from "next";
import Link from "next/link";
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

export default async function UsagePage() {
  const { user, store, plan } = await accountSession();
  const usage = store ? await store.usage(user.id, DAYS) : [];
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = Math.min(usage.find((u) => u.day === todayIso)?.calls ?? 0, plan.perDay);

  // One bar per day, oldest first, with the days that had no calls filled in.
  const byDay = new Map(usage.map((u) => [u.day, u.calls]));
  const series = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(Date.now() - (DAYS - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day: d, calls: Math.min(byDay.get(d) ?? 0, plan.perDay) };
  });
  const peak = Math.max(1, ...series.map((s) => s.calls));
  const total = series.reduce((sum, s) => sum + s.calls, 0);

  return (
    <div className="account">
      <div className="app-section">
        <h1 className="app-title">Usage</h1>
        <p className="app-lede">Counted for your whole account, across every key and connector. Days reset at 00:00 UTC.</p>
        <div className="app-stats">
          <div className="app-stat">
            <span className="app-stat-label">Tool calls today</span>
            <span className="app-stat-value">
              {n(today)}
              <small> / {n(plan.perDay)}</small>
            </span>
            <span className="app-meter" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (today / plan.perDay) * 100)}%` }} />
            </span>
          </div>
          <div className="app-stat">
            <span className="app-stat-label">Left today</span>
            <span className="app-stat-value">{n(Math.max(0, plan.perDay - today))}</span>
            <span className="app-stat-note">Resets in {untilReset()}</span>
          </div>
          <div className="app-stat">
            <span className="app-stat-label">Rate limit</span>
            <span className="app-stat-value">
              {plan.perMinute}
              <small> / minute</small>
            </span>
            <span className="app-stat-note">Every MCP request counts toward this</span>
          </div>
        </div>
      </div>

      <section className="panel" aria-labelledby="history-title">
        <div className="panel-head">
          <h2 id="history-title">Last {DAYS} days</h2>
          <p className="muted">
            A tool call is one question your agent (or Ask Cuely) asks. Connecting and listing tools don&apos;t count.
          </p>
        </div>
        {plan.id === "pro" ? (
          <>
            <p>
              <strong>{n(total)}</strong> tool calls in the last {DAYS} days.
            </p>
            <div className="bars" role="img" aria-label={`Tool calls per day for the last ${DAYS} days, peak ${n(peak)}`}>
              {series.map((s) => (
                <div key={s.day} className="bar" title={`${day(`${s.day}T12:00:00Z`)}: ${n(s.calls)} calls`}>
                  <i style={{ height: `${(s.calls / peak) * 100}%` }} />
                  <span>{s.day.slice(8)}</span>
                </div>
              ))}
            </div>
            <ul className="key-list">
              {[...series].reverse().filter((s) => s.calls > 0).map((s) => (
                <li key={s.day}>
                  <span>{day(`${s.day}T12:00:00Z`)}</span>
                  <span className="muted">{n(s.calls)} calls</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="empty">
            <p>
              Daily history is part of Pro, along with {n(PLANS.pro.perDay)} tool calls a day. Free shows today&apos;s count
              above.
            </p>
            <Link className="btn btn-quiet btn-small" href="/account/billing">
              See Pro
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
