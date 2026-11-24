import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { stackChanges } from "@/accounts/stacks";
import { checkProject } from "@/engine/check";
import { statedCompliance } from "@/freshness/compliance";
import { getRepository } from "@/repo";
import { SITE_URL } from "@/site";
import { ToolLogo } from "../../../_components/tool-logo";
import { CheckView } from "../../ask/_results";
import { plain, toolOptions } from "../../_options";
import { accountSession, day } from "../../_session";
import { deleteStackAction, markSeenAction } from "../actions";
import { StackForm } from "../_stack-form";

export const metadata: Metadata = { title: "Project · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function StackPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const { user, stacks } = await accountSession();
  const n = Number(id);
  const stack = stacks && Number.isInteger(n) ? await stacks.get(user.id, n) : null;
  if (!stack) notFound();

  const snap = await (await getRepository()).snapshot();
  const bySlug = new Map(snap.tools.map((t) => [t.slug, t]));
  const cat = new Map(snap.categories.map((c) => [c.slug, c.name]));
  const tools = stack.tools.map((t) => bySlug.get(t)).filter((t) => t !== undefined);
  const changes = stackChanges(stack.baseline, tools);
  const review = stack.description.trim().length >= 3 ? checkProject(snap, { description: stack.description, using: tools.map((t) => t.slug) }) : null;
  const monthly = tools.reduce((sum, t) => sum + (t.cost?.monthly ?? 0), 0);

  return (
    <div className="account">
      <div className="app-section">
        <Link href="/account/stacks" className="back-link">
          <ArrowLeft size={14} aria-hidden="true" /> Projects
        </Link>
        <h1 className="app-title">{stack.name}</h1>
        <p className="app-lede">{stack.description || `${tools.length} tools. Add a description to get keep-or-change advice.`}</p>
        <div className="app-stats">
          <div className="app-stat">
            <span className="app-stat-label">Tools</span>
            <span className="app-stat-value">{tools.length}</span>
          </div>
          <div className="app-stat">
            <span className="app-stat-label">At 1,000 users</span>
            <span className="app-stat-value">
              ${monthly.toLocaleString("en-US")}
              <small> / month</small>
            </span>
            <span className="app-stat-note">Sum of each tool at Cuely&apos;s usage profile</span>
          </div>
          <div className="app-stat">
            <span className="app-stat-label">Changes</span>
            <span className="app-stat-value">{changes.length}</span>
            <span className="app-stat-note">Since {day(stack.seenAt)}</span>
          </div>
        </div>
      </div>

      {saved && (
        <p className="notice" role="status">
          Saved. Cuely will flag changes to these tools here and on your overview.
        </p>
      )}

      <section className="panel" aria-labelledby="changes-title">
        <div className="panel-head">
          <h2 id="changes-title">What changed</h2>
          <p className="muted">Since you saved this stack or last marked it seen ({day(stack.seenAt)}).</p>
        </div>
        {changes.length ? (
          <>
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
              <button type="submit" className="btn btn-quiet btn-small">
                Mark as seen
              </button>
            </form>
          </>
        ) : (
          <p className="muted">Nothing yet. Prices, free plans, measured health and compliance answers all match.</p>
        )}
      </section>

      {review && review.status === "ok" && (
        <section className="panel" aria-labelledby="review-title">
          <div className="panel-head">
            <h2 id="review-title">Keep or change</h2>
            <p className="muted">Cuely&apos;s stack check on today&apos;s facts, for what you described.</p>
          </div>
          <CheckView result={review} />
        </section>
      )}

      <section className="panel" aria-labelledby="tools-title">
        <div className="panel-head">
          <h2 id="tools-title">Tools</h2>
          <p className="muted">Today&apos;s facts, each read from the vendor&apos;s own pages.</p>
        </div>
        <ul className="tool-facts">
          {tools.map((t) => {
            const stated = statedCompliance(t.compliance);
            return (
              <li key={t.slug}>
                <div className="tool-facts-head">
                  <ToolLogo slug={t.slug} name={t.name} size={28} />
                  <div>
                    <strong>{t.name}</strong>
                    <span className="muted small">{cat.get(t.category) ?? t.category}</span>
                  </div>
                  {t.health && t.health.score !== 0 && (
                    <span className={`badge ${t.health.score < 0 ? "badge-warn" : "badge-info"}`} title={`Measured ${t.health.measuredOn}`}>
                      Health {t.health.score > 0 ? "+" : ""}
                      {t.health.score}
                    </span>
                  )}
                  <a className="icon-link" href={`${SITE_URL}/tools/${t.slug}`} aria-label={`${t.name} on Cuely`}>
                    <ExternalLink size={14} />
                  </a>
                </div>
                <dl>
                  <dt>Free plan</dt>
                  <dd>{t.freeTier ?? "None"}</dd>
                  <dt>Paid from</dt>
                  <dd>{t.paidStartsAt ?? "—"}</dd>
                  {t.cost?.monthly != null && (
                    <>
                      <dt>At 1,000 users</dt>
                      <dd>
                        ${t.cost.monthly}/month <span className="muted small">{t.cost.basis}</span>
                      </dd>
                    </>
                  )}
                  {t.health && t.health.reasons.length > 0 && (
                    <>
                      <dt>Measured</dt>
                      <dd>{plain(t.health.reasons.join(" "))}</dd>
                    </>
                  )}
                  {stated.length > 0 && (
                    <>
                      <dt>Compliance</dt>
                      <dd>{plain(stated.join(" "))}</dd>
                    </>
                  )}
                  {t.watchOut[0] && (
                    <>
                      <dt>Watch out</dt>
                      <dd>{t.watchOut[0]}</dd>
                    </>
                  )}
                </dl>
                <p className="muted small">
                  Read {t.verifiedOn} from <a href={t.pricingUrl}>{new URL(t.pricingUrl).hostname}</a>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel" aria-labelledby="edit-title">
        <details>
          <summary>
            <h2 id="edit-title" className="inline-h">
              Edit or delete
            </h2>
          </summary>
          <div style={{ marginTop: 16 }}>
            <StackForm options={toolOptions(snap)} stack={stack} />
            <form action={deleteStackAction} className="danger-row">
              <input type="hidden" name="id" value={stack.id} />
              <span className="muted small">Deleting removes the stack and its history for good.</span>
              <button type="submit" className="btn btn-quiet btn-small">
                Delete stack
              </button>
            </form>
          </div>
        </details>
      </section>
    </div>
  );
}
