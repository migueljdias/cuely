"use client";

import { useEffect, useRef, useState } from "react";

export interface CategoryTab {
  slug: string;
  name: string;
  /** The current top tool's one-line pitch. */
  lead: string;
  /** What moved the order in the latest measurement, or what the tool is. */
  rest: string;
  free: string | null;
  tools: { slug: string; name: string }[];
}

const DURATION = 5200;

/**
 * One category at a time: the current default pick, why, and the order behind it. It moves
 * to the next category on its own until someone picks a tab or presses pause, and only
 * while it's on screen.
 */
export function CategoryTabs({ tabs }: { tabs: CategoryTab[] }) {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(false);
  const [visible, setVisible] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAuto(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setVisible(entries[0].isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = auto && visible;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setActive((i) => (i + 1) % tabs.length), DURATION);
    return () => window.clearTimeout(timer);
  }, [running, active, tabs.length]);

  // Keep the selected tab in view inside the strip without moving the page.
  useEffect(() => {
    const s = strip.current;
    const b = s?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!s || !b) return;
    if (b.offsetLeft + b.offsetWidth > s.scrollLeft + s.clientWidth || b.offsetLeft < s.scrollLeft) {
      s.scrollTo({ left: b.offsetLeft - 60, behavior: "smooth" });
    }
  }, [active]);

  const pick = (i: number) => {
    setAuto(false);
    setActive(i);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = (active + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    pick(next);
    strip.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };
  const c = tabs[active];

  return (
    <div className="tabs-box" ref={box} data-rv>
      <div className={`tab-strip${running ? " auto" : ""}`} ref={strip} style={{ ["--dur" as string]: `${DURATION}ms` }}>
        <button type="button" className="tab-pause" aria-label={auto ? "Pause rotation" : "Play rotation"} onClick={() => setAuto((v) => !v)}>
          <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            {auto ? (
              <>
                <rect x="2" y="1.5" width="2.8" height="9" rx=".8" />
                <rect x="7.2" y="1.5" width="2.8" height="9" rx=".8" />
              </>
            ) : (
              <path d="M3 1.5v9l7.5-4.5L3 1.5Z" />
            )}
          </svg>
        </button>
        <div role="tablist" aria-label="Categories" onKeyDown={onKey} className="tab-list">
          {tabs.map((t, i) => (
            <button key={t.slug} type="button" role="tab" id={`cat-tab-${t.slug}`} aria-selected={i === active} aria-controls="cat-panel" tabIndex={i === active ? 0 : -1} onClick={() => pick(i)}>
              {t.name} <span className="n">{String(t.tools.length).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="cat-card" id="cat-panel" role="tabpanel" aria-labelledby={`cat-tab-${c.slug}`} key={c.slug}>
        <div>
          <p className="cat-quote">
            <span className="hl">{c.lead}</span> {c.rest}
          </p>
          <p className="cat-meta">
            <b>{c.tools[0].name}</b>, default pick for <a href={`/categories/${c.slug}`}>{c.name.toLowerCase()}</a>
            {c.free ? ` · ${c.free}` : ""}
          </p>
        </div>
        <ol className="rank">
          {c.tools.map((t, k) => (
            <li key={t.slug} className={k === 0 ? "top" : undefined} style={{ ["--i" as string]: k }}>
              <span className="pos">{String(k + 1).padStart(2, "0")}</span>
              <a href={`/tools/${t.slug}`}>{t.name}</a>
              {k === 0 && <span className="badge">Default</span>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
