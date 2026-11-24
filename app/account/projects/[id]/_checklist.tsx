"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { ProjectCheckItem } from "@/accounts/checklist";
import { setCheckAction } from "../actions";

type Area = { area: string; label: string };

/**
 * The launch readiness card and the checklist beside it. Ticks show straight away and are
 * saved in the background; if saving fails the tick is undone and a note says so.
 */
export function ReadinessBoard({
  projectId,
  items,
  areas,
  phases,
}: {
  projectId: number;
  items: ProjectCheckItem[];
  areas: Area[];
  phases: { phase: string; label: string }[];
}) {
  const [optimistic, setOptimistic] = useOptimistic(items, (state, change: { id: string; done: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, doneOn: change.done ? new Date().toISOString().slice(0, 10) : null } : i)),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string, done: boolean) => {
    setError(null);
    startTransition(async () => {
      setOptimistic({ id, done });
      const res = await setCheckAction(projectId, id, done);
      if (!res.ok) setError("That tick wasn't saved. Try again in a moment.");
    });
  };

  const done = optimistic.filter((i) => i.doneOn).length;
  const total = optimistic.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const blockersLeft = optimistic.filter((i) => i.blocks && !i.doneOn).length;

  return (
    <>
      <section className="card ready-card" aria-labelledby="h-score">
        <h2 id="h-score">Launch readiness</h2>
        <div className="ready-ring" role="img" aria-label={`${pct} percent ready`} style={{ ["--pct" as string]: `${pct}%` }}>
          <span>{pct}%</span>
        </div>
        <p className="ready-sum">
          {done} of {total} done
          {blockersLeft > 0 ? ` · ${blockersLeft} blocking launch` : total ? " · nothing blocking launch" : ""}
        </p>
        <dl className="ready-areas">
          {areas.map((a) => {
            const list = optimistic.filter((i) => i.area === a.area);
            const d = list.filter((i) => i.doneOn).length;
            const blocking = list.some((i) => i.blocks && !i.doneOn);
            return (
              <div key={a.area}>
                <dt>{a.label}</dt>
                <dd className={d === list.length ? "is-good" : blocking ? "is-warn" : undefined}>
                  {d} / {list.length}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="card checklist-card" aria-label="Launch checklist">
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        {phases.map(({ phase, label }) => {
          const list = optimistic.filter((i) => i.phase === phase);
          if (!list.length) return null;
          return (
            <div key={phase} className="checklist-phase">
              <div className="checklist-phase-head">
                <h2>{label}</h2>
                <span>
                  {list.filter((i) => i.doneOn).length} of {list.length} done
                </span>
              </div>
              <ul className="checklist">
                {list.map((i) => {
                  const inputId = `chk-${i.id}`;
                  return (
                    <li key={i.id} className={i.doneOn ? "is-done" : undefined}>
                      <input id={inputId} type="checkbox" checked={Boolean(i.doneOn)} onChange={(e) => toggle(i.id, e.target.checked)} />
                      <div>
                        <label htmlFor={inputId}>{i.title}</label>
                        <p>{i.detail}</p>
                        <details>
                          <summary>Why</summary>
                          <p>
                            {i.why} <a href={i.source}>Source</a>
                          </p>
                        </details>
                      </div>
                      {i.blocks && !i.doneOn ? (
                        <span className="badge badge-warn">Blocks launch</span>
                      ) : (
                        <span className="checklist-area">{areas.find((a) => a.area === i.area)?.label}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {!total && <p className="muted">No checklist items apply yet. Add tools or a description to this project.</p>}
      </section>
    </>
  );
}
