"use client";

import { useState, useTransition } from "react";
import { setThemeAction } from "../actions";

const THEMES = [
  { id: "dark", label: "Dark", a: "#0b1020", b: "#141b33" },
  { id: "light", label: "Light", a: "#f4f6fb", b: "#ffffff" },
  { id: "system", label: "Match system", a: "#0b1020", b: "#f4f6fb" },
];

/** Dark, light or system. Switches the page at once, then saves the choice to the account. */
export function ThemePicker({ initial }: { initial: string }) {
  const [theme, setTheme] = useState(initial);
  const [error, setError] = useState(false);
  const [, start] = useTransition();

  const apply = (t: string) => document.querySelector<HTMLElement>(".app")?.setAttribute("data-theme", t);

  const pick = (next: string) => {
    if (next === theme) return;
    const prev = theme;
    setTheme(next);
    setError(false);
    apply(next);
    start(async () => {
      const res = await setThemeAction(next);
      if (!res.ok) {
        setTheme(prev);
        apply(prev);
        setError(true);
      }
    });
  };

  return (
    <>
      <div role="radiogroup" aria-label="Theme" className="theme-grid">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme === t.id}
            className={`theme-option${theme === t.id ? " is-on" : ""}`}
            onClick={() => pick(t.id)}
          >
            <span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${t.a} 0 50%, ${t.b} 50% 100%)` }} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          That wasn&apos;t saved. Try again in a moment.
        </p>
      )}
    </>
  );
}
