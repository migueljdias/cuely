import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { stackChanges } from "@/accounts/stacks";
import { getRepository } from "@/repo";
import { ToolLogo } from "../../_components/tool-logo";
import { toolOptions } from "../_options";
import { accountSession, day } from "../_session";
import { StackForm } from "./_stack-form";

export const metadata: Metadata = { title: "Projects · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function StacksPage() {
  const { user, stacks: store, plan } = await accountSession();
  const [stacks, snap] = await Promise.all([store ? store.list(user.id) : [], getRepository().then((r) => r.snapshot())]);
  const bySlug = new Map(snap.tools.map((t) => [t.slug, t]));
  const full = stacks.length >= plan.maxStacks;

  return (
    <div className="account">
      <div className="app-section">
        <h1 className="app-title">Projects</h1>
        <p className="app-lede">
          Save the tools each project uses. Cuely re-reads vendor pricing and compliance pages and measures outages on a
          schedule, and shows you here what changed since you last looked.
        </p>
      </div>

      {!store && (
        <p className="notice" role="status">
          Saved stacks need a database, and none is configured on this deployment.
        </p>
      )}

      {stacks.length > 0 && (
        <section className="panel" aria-labelledby="list-title">
          <div className="panel-head">
            <h2 id="list-title">
              Saved <span className="tag">{stacks.length} / {plan.maxStacks}</span>
            </h2>
          </div>
          <ul className="row-list">
            {stacks.map((s) => {
              const tools = s.tools.map((t) => bySlug.get(t)).filter((t) => t !== undefined);
              const changes = stackChanges(s.baseline, tools);
              return (
                <li key={s.id}>
                  <Link href={`/account/stacks/${s.id}`} className="row-link">
                    <span className="logo-stack" aria-hidden="true">
                      {tools.slice(0, 5).map((t) => (
                        <ToolLogo key={t.slug} slug={t.slug} name={t.name} size={22} />
                      ))}
                    </span>
                    <span className="row-main">
                      <strong>{s.name}</strong>
                      <span className="muted small">
                        {tools.map((t) => t.name).join(", ")} · checked {day(s.seenAt)}
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
              );
            })}
          </ul>
        </section>
      )}

      {store && (
        <section className="panel" aria-labelledby="new-title">
          <div className="panel-head">
            <h2 id="new-title">{stacks.length ? "Save another stack" : "Save your first stack"}</h2>
            <p className="muted">
              Only what you type here is stored: the name, the tools and the optional description. Delete it anytime.
            </p>
          </div>
          {full ? (
            <p>
              You&apos;ve saved {plan.maxStacks} stacks, the most on the {plan.name} plan.{" "}
              {plan.id === "free" ? <Link href="/account/billing">Pro saves up to 50.</Link> : "Delete one to save another."}
            </p>
          ) : (
            <StackForm options={toolOptions(snap)} />
          )}
        </section>
      )}
    </div>
  );
}
