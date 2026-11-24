import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { PHASE_LABELS, projectChecklist, readiness } from "@/accounts/checklist";
import { stackChanges } from "@/accounts/stacks";
import type { Tool } from "@/catalog";
import { checkProject, type CheckItem } from "@/engine/check";
import { statedCompliance } from "@/freshness/compliance";
import { getRepository } from "@/repo";
import { SITE_URL } from "@/site";
import { ToolLogo } from "../../../_components/tool-logo";
import { plain, toolOptions } from "../../_options";
import { accountSession, day } from "../../_session";
import { deleteStackAction, markSeenAction } from "../actions";
import { StackForm } from "../_stack-form";
import { ReadinessBoard } from "./_checklist";

export const metadata: Metadata = { title: "Project · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("en-US");
/** What a tool costs a month at 1,000 users, when the catalog has worked it out. */
const at1k = (t: Tool) => (t.cost && t.cost.scale !== "10_staff" ? t.cost.monthly : null);

function verdictText(item: CheckItem): { text: string; tone: "good" | "warn" | "info" } {
  if (item.verdict === "switch" && item.suggestion) return { text: `Change → ${item.suggestion.name}`, tone: "warn" };
  if (item.verdict === "add" && item.suggestion) return { text: `Add ${item.suggestion.name}`, tone: "info" };
  return { text: "Keep", tone: "good" };
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const { user, stacks } = await accountSession();
  const num = Number(id);
  const stack = stacks && Number.isInteger(num) ? await stacks.get(user.id, num) : null;
  if (!stack) notFound();

  const snap = await (await getRepository()).snapshot();
  const bySlug = new Map(snap.tools.map((t) => [t.slug, t]));
  const cat = new Map(snap.categories.map((c) => [c.slug, c.name]));
  const tools = stack.tools.map((t) => bySlug.get(t)).filter((t) => t !== undefined);
  const changes = stackChanges(stack.baseline, tools);
  const review = stack.description.trim().length >= 3 ? checkProject(snap, { description: stack.description, using: tools.map((t) => t.slug) }) : null;

  const items = projectChecklist(stack, tools);
  const score = readiness(items);

  const costs = tools.map((t) => ({ tool: t, monthly: at1k(t) })).filter((c): c is { tool: Tool; monthly: number } => c.monthly !== null);
  const monthly = costs.reduce((sum, c) => sum + c.monthly, 0);
  const priciest = [...costs].sort((a, b) => b.monthly - a.monthly).filter((c) => c.monthly > 0);
  const variable = tools.filter((t) => t.cost?.variable);

  // Keep / change / add for each tool, from the stack check when there's a description.
  const verdicts = new Map((review?.status === "ok" ? review.items : []).filter((i) => i.current).map((i) => [i.current!.slug, i]));
  const adds = review?.status === "ok" ? review.items.filter((i) => i.verdict === "add" && i.suggestion && i.role === "core") : [];

  return (
    <div className="project">
      <div className="home-head">
        <div>
          <h1 className="app-h1">{stack.name}</h1>
          <p className="project-desc">{stack.description || "Add a description to get keep-or-change advice and a checklist that fits."}</p>
        </div>
        <div className="home-actions">
          <a className="btn-app" href={`/account/projects/${stack.id}/checklist`} download>
            <Download size={16} aria-hidden="true" /> Export checklist
          </a>
          <a className="btn-app btn-app-primary" href="#edit">
            Edit project
          </a>
        </div>
      </div>

      {saved && (
        <p className="notice" role="status">
          Saved. Cuely will flag changes to these tools here and on Home.
        </p>
      )}

      <nav className="project-tabs" aria-label="Project sections">
        <a href="#ready">Readiness</a>
        <a href="#stack">Stack</a>
        <a href="#cost">Cost</a>
        <a href="#changes">Alerts ({changes.length})</a>
      </nav>

      <div id="ready" className="ready-grid">
        <ReadinessBoard
          projectId={stack.id}
          items={items}
          areas={score.areas.map(({ area, label }) => ({ area, label }))}
          phases={Object.entries(PHASE_LABELS).map(([phase, label]) => ({ phase, label }))}
        />

        <div className="project-side">
          <section id="cost" className="card" aria-labelledby="h-cost">
            <h2 className="card-title">Cost as you grow</h2>
            <p className="card-sub">Priced from each vendor&apos;s own page.</p>
            <div className="cost-tiles">
              <div className="cost-tile is-on">
                <span>1k users</span>
                <strong>{costs.length ? `$${n(monthly)}` : "–"}</strong>
              </div>
              <div className="cost-tile">
                <span>10k users</span>
                <strong className="muted">Soon</strong>
              </div>
              <div className="cost-tile">
                <span>50k users</span>
                <strong className="muted">Soon</strong>
              </div>
            </div>
            {priciest.length > 0 && (
              <p className="card-text">
                Most of it: {priciest.slice(0, 2).map((c) => `${c.tool.name} ($${n(c.monthly)})`).join(" and ")}.
              </p>
            )}
            {variable.length > 0 && (
              <p className="card-text muted small">
                On top, as you earn: {variable.map((t) => `${t.name} ${t.cost!.variable}`).join("; ")}.
              </p>
            )}
            {costs.length < tools.length && (
              <p className="card-text muted small">{tools.length - costs.length} tool(s) have no cost figure in the catalog yet.</p>
            )}
          </section>

          <section id="stack" className="card" aria-labelledby="h-stack">
            <h2 id="h-stack" className="card-title">
              Stack
            </h2>
            <ul className="stack-rows">
              {tools.map((t) => {
                const item = verdicts.get(t.slug);
                const v = item ? verdictText(item) : null;
                const down = (t.health?.score ?? 0) < 0;
                return (
                  <li key={t.slug}>
                    <span>
                      {t.name} <span className="muted">{(cat.get(t.category) ?? t.category).toLowerCase()}</span>
                    </span>
                    {v ? (
                      <span className={`stack-verdict is-${down && v.tone === "good" ? "warn" : v.tone}`}>
                        {v.text}
                        {down ? " · health down" : ""}
                      </span>
                    ) : down ? (
                      <span className="stack-verdict is-warn">Health down</span>
                    ) : null}
                  </li>
                );
              })}
              {adds.map((a) => (
                <li key={`add-${a.category}`}>
                  <span>{a.categoryName}</span>
                  <span className="stack-verdict is-info">Add {a.suggestion!.name}</span>
                </li>
              ))}
            </ul>
            {!review && <p className="card-text muted small">Add a description and Cuely will say whether to keep or change each tool.</p>}
            {review && review.status !== "ok" && <p className="card-text muted small">{review.headline}</p>}
          </section>
        </div>
      </div>

      <section id="changes" className="card" aria-labelledby="changes-title">
        <div className="card-head">
          <h2 id="changes-title">What changed</h2>
          <span className="muted small">Since you saved this project or last marked it seen ({day(stack.seenAt)}).</span>
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
              <button type="submit" className="btn-app btn-app-small">
                Mark as seen
              </button>
            </form>
          </>
        ) : (
          <p className="muted">Nothing yet. Prices, free plans, measured health and compliance answers all match.</p>
        )}
      </section>

      <section className="card" aria-labelledby="tools-title">
        <div className="card-head">
          <h2 id="tools-title">Tools</h2>
          <span className="muted small">Today&apos;s facts, each read from the vendor&apos;s own pages.</span>
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

      <section id="edit" className="card" aria-labelledby="edit-title">
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
              <span className="muted small">Deleting removes the project, its checklist ticks and its history for good.</span>
              <button type="submit" className="btn-app btn-app-small">
                Delete project
              </button>
            </form>
          </div>
        </details>
      </section>
    </div>
  );
}
