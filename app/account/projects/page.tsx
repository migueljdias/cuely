import type { Metadata } from "next";
import Link from "next/link";
import type { Tool } from "@/catalog";
import { toolOptions } from "../_options";
import { accountSession, day, projectsOverview } from "../_session";
import { StackForm } from "./_stack-form";

export const metadata: Metadata = { title: "Projects · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("en-US");
const plural = (v: number, one: string) => `${n(v)} ${v === 1 ? one : `${one}s`}`;
/** What a tool costs a month at 1,000 users, when the catalog has worked it out. */
const at1k = (t: Tool) => (t.cost && t.cost.scale !== "10_staff" ? t.cost.monthly : null);

export default async function ProjectsPage() {
  const [{ plan }, { projects, snap, hasStore }] = await Promise.all([accountSession(), projectsOverview()]);
  const full = projects.length >= plan.maxStacks;

  return (
    <div className="projects">
      <div className="home-head">
        <div>
          <h1 className="app-h1">Projects</h1>
          <p className="project-desc">Each project is watched for price, outage and compliance changes, with its own launch checklist.</p>
        </div>
        <span className="muted">
          {n(projects.length)} of {n(plan.maxStacks)} on {plan.name}
        </span>
      </div>

      {!hasStore && (
        <p className="notice" role="status">
          Projects need a database, and none is configured on this deployment.
        </p>
      )}

      <section className="add-grid" aria-label="Add a project">
        <Link className="add-card is-primary" href="/account/ask?mode=start">
          <span className="add-kicker">New build</span>
          <strong>Describe what you&apos;re building</strong>
          <span>Get the stack, the cost and the checklist, then save it as a project.</span>
        </Link>
        <div className="add-card is-soon" aria-disabled="true">
          <span className="add-kicker">
            Existing repo <span className="badge">Soon</span>
          </span>
          <strong>Import from GitHub</strong>
          <span>Will read package and env variable names, never values.</span>
        </div>
        <a className="add-card" href="#new">
          <span className="add-kicker">By hand</span>
          <strong>Pick the tools you use</strong>
          <span>Type Vercel, Supabase, Clerk… and Cuely starts watching them.</span>
        </a>
      </section>

      {projects.length > 0 && (
        <section className="card table-card" aria-label="Your projects">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Stack</th>
                  <th scope="col">Readiness</th>
                  <th scope="col">At 1k users</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last checked</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(({ stack, tools, changes, ready }) => {
                  const costs = tools.map(at1k).filter((v): v is number => v !== null);
                  const worse = changes.some((c) => c.tone === "worse");
                  return (
                    <tr key={stack.id}>
                      <td>
                        <Link className="table-name" href={`/account/projects/${stack.id}`}>
                          {stack.name}
                        </Link>
                        <span className="table-sub">{stack.description ? stack.description : "Saved by hand"}</span>
                      </td>
                      <td className="table-stack" data-label="Stack">{tools.map((t) => t.name).join(", ") || "–"}</td>
                      <td className="table-ready" data-label="Readiness">
                        {ready.total ? (
                          <span>
                            <span className="app-meter" aria-hidden="true">
                              <i style={{ width: `${ready.pct}%` }} />
                            </span>
                            {ready.pct}%
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td data-label="At 1k users">{costs.length ? `$${n(costs.reduce((s, v) => s + v, 0))}` : "–"}</td>
                      <td data-label="Status">
                        {ready.blockersLeft ? (
                          <span className="badge badge-warn">{plural(ready.blockersLeft, "blocker")}</span>
                        ) : changes.length ? (
                          <span className={`badge ${worse ? "badge-warn" : "badge-info"}`}>{plural(changes.length, "change")}</span>
                        ) : (
                          <span className="badge badge-good">Healthy</span>
                        )}
                      </td>
                      <td className="muted" data-label="Last checked">{day(stack.seenAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {hasStore && (
        <section id="new" className="card" aria-labelledby="new-title">
          <div className="card-head">
            <h2 id="new-title">{projects.length ? "Add a project by hand" : "Add your first project"}</h2>
            <span className="muted small">Only what you type is stored: the name, the tools and the optional description.</span>
          </div>
          {full ? (
            <p>
              You have {n(plan.maxStacks)} projects, the most on the {plan.name} plan.{" "}
              {plan.id === "free" ? <Link href="/account/billing">Pro keeps up to 50.</Link> : "Delete one to add another."}
            </p>
          ) : (
            <StackForm options={toolOptions(snap)} />
          )}
        </section>
      )}
    </div>
  );
}
