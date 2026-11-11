"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface TranscriptRow {
  category: string;
  name: string;
  reason: string;
  logo: ReactNode;
}

interface Props {
  prompt: string;
  query: string;
  rows: TranscriptRow[];
  recipe: string | null;
}

const TYPE_MS = 24;
const CALL_MS = 16;
const ROW_MS = 110;

/**
 * The hero example. The server renders the finished transcript; with JavaScript and
 * motion allowed, it replays once when it scrolls into view: the request types out,
 * the call goes out, then the picks settle in one by one.
 */
export function Transcript({ prompt, query, rows, recipe }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState(4); // 0 idle, 1 typing prompt, 2 typing call, 3 rows, 4 done
  const [chars, setChars] = useState(0);

  const call = `recommend_stack("${query}")`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPlaying(true);
    setPhase(0);

    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const type = (text: string, ms: number, done: () => void) => {
      let i = 0;
      setChars(0);
      const id = window.setInterval(() => {
        i += 1;
        setChars(i);
        if (i >= text.length) {
          window.clearInterval(id);
          done();
        }
      }, ms);
      timers.push(id);
    };

    const start = () => {
      setPhase(1);
      later(
        () =>
          type(prompt, TYPE_MS, () =>
            later(() => {
              setPhase(2);
              type(call, CALL_MS, () =>
                later(() => {
                  setPhase(3);
                  later(() => setPhase(4), rows.length * ROW_MS + 420);
                }, 360),
              );
            }, 320),
          ),
        240,
      );
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect();
          start();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      timers.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
    };
    // Plays once per page view.
  }, []);

  const on = (n: number) => (phase >= n ? " on" : "");
  const promptShown = playing && phase === 1 ? prompt.slice(0, chars) : prompt;
  const callShown = playing && phase === 2 ? call.slice(0, chars) : call;
  const typing = playing && (phase === 1 || phase === 2);

  return (
    <figure
      ref={ref}
      className={`transcript${playing ? " playing" : ""}`}
      aria-label="Example: an agent asks Cuely for a stack"
    >
      <div className="t-bar">
        <span>agent session</span>
        <span>cuely.dev/api/mcp</span>
      </div>
      <div className="t-body">
        <p className={`t-line t-step${on(1)}`}>
          <span className="t-who">you</span>
          <span>
            <span className="sr-only">{prompt}</span>
            <span aria-hidden="true">
              {promptShown}
              {typing && phase === 1 && <span className="caret" />}
            </span>
          </span>
        </p>
        <p className={`t-line t-step${on(2)}`}>
          <span className="t-who">agent</span>
          <code className="t-code">
            <span className="sr-only">{call}</span>
            <span aria-hidden="true">
              {callShown}
              {typing && phase === 2 && <span className="caret" />}
            </span>
          </code>
        </p>
        <ol className={`t-result t-step${on(3)}`}>
          {rows.map((r, i) => (
            <li key={r.category} style={{ "--i": i } as React.CSSProperties}>
              <span className="t-cat">{r.category}</span>
              <span className="t-pick">
                <span className="t-logo">{r.logo}</span>
                {r.name}
                <span className="cue" aria-hidden="true" />
              </span>
              <span className="t-why">{r.reason}</span>
            </li>
          ))}
        </ol>
        <p className={`t-line t-step${on(4)}`}>
          <span className="t-who">cuely</span>
          <span>
            {recipe ? (
              <>
                Matched recipe <code className="t-code">{recipe}</code>. Next: get_recipe for the build steps.
              </>
            ) : (
              "Stack ready. Ask for get_recipe when there is one for this build."
            )}
          </span>
        </p>
      </div>
      <figcaption>Generated live from the catalog</figcaption>
    </figure>
  );
}
