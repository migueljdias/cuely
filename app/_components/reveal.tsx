"use client";

import { useEffect } from "react";

/**
 * Fades in anything marked data-reveal the first time it scrolls into view.
 * CSS only hides those elements once this has run (html.reveal-ready), and never
 * under prefers-reduced-motion, so the page reads fine without JavaScript.
 */
export function RevealObserver() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    for (const el of els) {
      // Anything already on screen shows at once, without a fade.
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("is-in");
      else io.observe(el);
    }
    document.documentElement.classList.add("reveal-ready");
    return () => io.disconnect();
  }, []);
  return null;
}
