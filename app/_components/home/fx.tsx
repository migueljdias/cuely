"use client";

import { useEffect } from "react";

/**
 * The home page's scroll and playback motion, wired onto the server-rendered page:
 * sections ease in as they enter the screen, the example answer types itself once, and the
 * update log keeps cycling. Everything is readable without it: the page renders complete,
 * and none of this runs under prefers-reduced-motion.
 */
export function HomeFx() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.querySelector<HTMLElement>(".hp");
    if (!root) return;
    const cleanups: (() => void)[] = [];

    // Reveal, from a dimmed resting state rather than from nothing.
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    root.querySelectorAll<HTMLElement>("[data-rv]").forEach((el) => {
      el.classList.add("rv");
      io.observe(el);
    });
    root.querySelectorAll<HTMLElement>("[data-rv-each]").forEach((grid) =>
      Array.from(grid.children).forEach((el, n) => {
        el.classList.add("rv");
        (el as HTMLElement).style.setProperty("--rd", `${(n % 3) * 90}ms`);
        io.observe(el);
      }),
    );
    cleanups.push(() => io.disconnect());

    // The example answer: type the question, then let the rows and the cost arrive.
    const term = root.querySelector<HTMLElement>("[data-term]");
    const typed = term?.querySelector<HTMLElement>("[data-typed]");
    const cost = term?.querySelector<HTMLElement>("[data-cost]");
    if (term && typed) {
      const tio = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) return;
          tio.disconnect();
          const full = typed.textContent ?? "";
          let n = 0;
          typed.textContent = "";
          term.classList.add("play");
          const cur = document.createElement("span");
          cur.className = "cur";
          typed.after(cur);
          const iv = window.setInterval(() => {
            n += 1;
            typed.textContent = full.slice(0, n);
            if (n >= full.length) {
              window.clearInterval(iv);
              window.setTimeout(() => cur.remove(), 1400);
            }
          }, 26);
          cleanups.push(() => window.clearInterval(iv));
          if (cost) {
            const target = Number(cost.textContent) || 0;
            cost.textContent = "0";
            const timer = window.setTimeout(() => {
              const start = performance.now();
              const up = (now: number) => {
                const k = Math.min(1, (now - start) / 900);
                cost.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
                if (k < 1) requestAnimationFrame(up);
              };
              requestAnimationFrame(up);
            }, 2300);
            cleanups.push(() => {
              window.clearTimeout(timer);
              cost.textContent = String(target);
            });
          }
        },
        { threshold: 0.35 },
      );
      tio.observe(term);
      cleanups.push(() => tio.disconnect());
    }

    // The update log: the last row moves to the top every few seconds while it's on screen.
    const log = root.querySelector<HTMLElement>("[data-log]");
    if (log) {
      let visible = false;
      const lio = new IntersectionObserver((entries) => (visible = entries[0].isIntersecting));
      lio.observe(log);
      const iv = window.setInterval(() => {
        const lastRow = log.lastElementChild;
        if (!visible || !lastRow) return;
        Array.from(log.children).forEach((d) => d.classList.remove("new"));
        log.insertBefore(lastRow, log.firstChild);
        lastRow.classList.add("new");
      }, 3200);
      cleanups.push(() => {
        lio.disconnect();
        window.clearInterval(iv);
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
