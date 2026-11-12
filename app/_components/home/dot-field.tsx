"use client";

import { useEffect, useRef } from "react";

/**
 * The dot field behind the blue panels: a grid of dots with slow ripples spreading from the
 * glow at the bottom edge. It draws one still frame for visitors who ask for reduced motion,
 * and only animates while the panel is on screen.
 */
export function DotField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const panel = cv?.parentElement;
    const g = cv?.getContext("2d");
    if (!cv || !panel || !g) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let on = false;
    let last = 0;

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const step = w < 600 ? 9 : 8;
      const ox = w / 2;
      const oy = h * 1.05;
      const maxd = Math.hypot(w / 2, h);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.fillStyle = "#fff";
      for (let y = step / 2; y < h; y += step) {
        for (let x = step / 2; x < w; x += step) {
          const d = Math.hypot(x - ox, y - oy);
          const near = 1 - d / maxd;
          const wave = Math.sin(d * 0.03 - t * 1.5);
          const a = 0.07 + Math.max(0, wave) * 0.32 * (0.25 + near * near * 1.6);
          if (a < 0.08) continue;
          g.globalAlpha = Math.min(a, 0.7);
          const size = wave > 0.6 ? 1.8 : 1.2;
          g.fillRect(x, y, size, size);
        }
      }
    };
    const size = () => {
      const r = panel.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      cv.width = w * dpr;
      cv.height = h * dpr;
      draw(performance.now());
    };
    const loop = (now: number) => {
      if (!on) return;
      if (now - last > 40) {
        last = now;
        draw(now);
      }
      raf = requestAnimationFrame(loop);
    };

    size();
    const ro = new ResizeObserver(size);
    ro.observe(panel);
    let io: IntersectionObserver | null = null;
    if (!reduce) {
      io = new IntersectionObserver((entries) => {
        on = entries[0].isIntersecting;
        cancelAnimationFrame(raf);
        if (on) raf = requestAnimationFrame(loop);
      });
      io.observe(panel);
    }
    return () => {
      on = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="fx-canvas" aria-hidden="true" />;
}
