"use client";

import { useState } from "react";

export interface Mode {
  id: string;
  label: string;
  title: string;
  text: string;
  /** What you'd say to your agent. */
  ask: string;
  rows: { tone: "blue" | "warn" | "good"; tag: string; text: string; note?: string }[];
}

const ICONS: Record<string, React.ReactNode> = {
  start: <path d="M7 4.5v15l12-7.5-12-7.5Z" strokeLinejoin="round" />,
  check: <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16" />,
  compare: <path d="M7 4v16M17 4v16M3 9l4-5 4 5M13 15l4 5 4-5" strokeLinejoin="round" />,
};

/** The three ways to use Cuely, each with what you ask and what really comes back. */
export function ModeTabs({ modes }: { modes: Mode[] }) {
  const [active, setActive] = useState(modes[0].id);
  const m = modes.find((x) => x.id === active) ?? modes[0];
  return (
    <>
      <div className="seg" role="tablist" aria-label="When to run Cuely" data-rv>
        {modes.map((x) => (
          <button key={x.id} type="button" role="tab" id={`mode-tab-${x.id}`} aria-selected={x.id === active} aria-controls="mode-panel" onClick={() => setActive(x.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              {ICONS[x.id]}
            </svg>
            {x.label}
          </button>
        ))}
      </div>
      <div className="mode tick" id="mode-panel" role="tabpanel" aria-labelledby={`mode-tab-${m.id}`} key={m.id}>
        <div>
          <h3>{m.title}</h3>
          <p>{m.text}</p>
          <p className="ask">{m.ask}</p>
        </div>
        <div>
          <div className="out">
            {m.rows.map((r, n) => (
              <div className="out-row" key={r.tag + n} style={{ ["--i" as string]: n }}>
                <span className={`tg ${r.tone}`}>{r.tag}</span>
                <div>
                  {r.text}
                  {r.note && <small>{r.note}</small>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
