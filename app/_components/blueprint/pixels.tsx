"use client";

import { useCallback, useEffect, useRef } from "react";

/*
  The landing page's pixel art. Every drawing reads its colours from CSS custom properties on
  the element, so it follows light and dark mode, and is drawn complete at rest. Motion only
  replays a finished drawing, and never runs under prefers-reduced-motion.
*/

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function tokens(el: Element) {
  const c = getComputedStyle(el);
  return (name: string) => c.getPropertyValue(name).trim();
}

/** Repaints when the colour scheme changes, so the canvas never keeps the old mode's colours. */
function useSchemeChange(paint: () => void) {
  useEffect(() => {
    paint();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", paint);
    return () => mq.removeEventListener("change", paint);
  }, [paint]);
}

/* 12x12 sprites for the three steps. "." is empty, b blue, i ink, t tint. */
const SPRITES = {
  chat: ["............", ".bbbbbbbbbb.", "bttttttttttb", "btiitiiitttb", "bttttttttttb", "btiiitiitttb", "bttttttttttb", ".bbbbbbbbbb.", "...bb.......", "...b........", "............", "............"],
  rules: ["............", ".....ii.....", ".iiiiiiiiii.", ".i...ii...i.", "bbb..ii..ttt", "bbb..ii..ttt", "bbb..ii..ttt", ".....ii.....", ".....ii.....", "...iiiiii...", "............", "............"],
  plan: ["..iiiiiiii..", "..i......i..", "..i.bb.tt.i.", "..i......i..", "..i.bb.ttt..", "..i......i..", "..i.bb.tt.i.", "..i......i..", "..i.bb....i.", "..i......i..", "..iiiiiiii..", "............"],
} as const;

export function PixelSprite({ name }: { name: keyof typeof SPRITES }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const paint = useCallback(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const v = tokens(cv);
    const pal: Record<string, string> = { b: v("--bp-blue"), i: v("--bp-ink"), t: v("--bp-tint") };
    g.clearRect(0, 0, cv.width, cv.height);
    SPRITES[name].forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (pal[ch]) {
          g.fillStyle = pal[ch];
          g.fillRect(x, y, 1, 1);
        }
      }),
    );
  }, [name]);
  useSchemeChange(paint);
  return <canvas ref={ref} className="bp-sprite" width={12} height={12} aria-hidden="true" />;
}

/** The logo tile and half circle, stepped like pixel art, for the closing plate. */
export function PixelLogo() {
  const ref = useRef<HTMLCanvasElement>(null);
  const paint = useCallback(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const v = tokens(cv);
    const N = 56, R = 12, cx = 27.5, cy = 38, rr = 18;
    g.clearRect(0, 0, N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const dx = Math.max(R - x, 0, x - (N - 1 - R)), dy = Math.max(R - y, 0, y - (N - 1 - R));
        if (dx * dx + dy * dy > R * R) continue;
        g.fillStyle = v("--bp-blue");
        g.fillRect(x, y, 1, 1);
        const inHalf = y < cy && (x - cx) ** 2 + (y - cy) ** 2 < rr * rr;
        const dither = y >= 38 && y < 40 && x > 9 && x < 46 && (x + y) % 2 === 1;
        if (inHalf || dither) {
          g.fillStyle = v("--bp-tint");
          g.fillRect(x, y, 1, 1);
        }
      }
  }, []);
  useSchemeChange(paint);
  return <canvas ref={ref} className="bp-pixlogo" width={56} height={56} aria-hidden="true" />;
}

export interface StackRow {
  category: string;
  name: string;
  reason: string;
}

/**
 * Fig. 1: the demo answer drawn as an isometric stack of pixel slabs, one per category.
 * Drawn complete on load; the first time it scrolls into view (or on Replay) the slabs drop in.
 */
export function StackFigure({ rows, cost, call }: { rows: StackRow[]; cost: string; call: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const legend = useRef<HTMLOListElement>(null);
  const raf = useRef(0);

  const W = 220, H = 178, A = 64, B = 32, T = 11, CX = 110, BASE = 132;
  const restY = (i: number) => BASE - i * T;

  const setLegend = useCallback((n: number) => {
    legend.current?.querySelectorAll("li").forEach((li, i) => li.classList.toggle("is-pending", i >= n));
  }, []);

  type Spark = { x: number; y: number; vx: number; vy: number; life: number };
  const frame = useCallback(
    (ys: (number | null)[], sparks: Spark[] = []) => {
      const cv = canvas.current;
      const g = cv?.getContext("2d");
      if (!cv || !g) return;
      const v = tokens(cv);
      const top = v("--bp-slab-top"), left = v("--bp-slab-left"), right = v("--bp-slab-right"), edge = v("--bp-slab-edge");
      g.clearRect(0, 0, W, H);

      // Dithered shadow under the stack
      g.fillStyle = edge;
      g.globalAlpha = 0.2;
      const scy = BASE + T + 6, sa = A + 10, sb = B + 5;
      for (let x = CX - sa; x <= CX + sa; x++) {
        const k = 1 - Math.abs(x - CX) / sa;
        for (let y = Math.round(scy - sb * k); y <= Math.round(scy + sb * k); y++) if ((x + y) % 2 === 0) g.fillRect(x, y, 1, 1);
      }
      g.globalAlpha = 1;

      ys.forEach((ty, idx) => {
        if (ty === null) return;
        for (let x = CX - A; x <= CX + A; x++) {
          const k = 1 - Math.abs(x - CX) / A;
          const yTop = Math.round(ty - B * k), yLow = Math.round(ty + B * k);
          for (let y = yTop; y <= yLow + T; y++) {
            let c: string;
            if (y <= yLow) c = y === yTop || y === yLow || x === CX - A || x === CX + A ? edge : top;
            else c = x < CX ? left : right;
            if (y > yLow && x >= CX && (x + y) % 2 === 0) c = edge; // dither on the shaded side
            if (y === yLow + T || (y > yLow && (x === CX - A || x === CX + A || x === CX))) c = edge;
            g.fillStyle = c;
            g.fillRect(x, y, 1, 1);
          }
        }
        // One small light per layer on the front left face
        g.fillStyle = top;
        for (let n = 0; n <= idx; n++) {
          const x = CX - A + 8 + n * 4;
          const k = 1 - Math.abs(x - CX) / A;
          g.fillRect(x, Math.round(ty + B * k) + 5, 2, 2);
        }
      });

      g.fillStyle = v("--bp-blue");
      for (const p of sparks) {
        g.globalAlpha = Math.max(0, p.life);
        g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
      g.globalAlpha = 1;
    },
    [],
  );

  const finalFrame = useCallback(() => {
    cancelAnimationFrame(raf.current);
    frame(rows.map((_, i) => restY(i)));
    setLegend(rows.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, rows, setLegend]);

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (reducedMotion()) return finalFrame();
    const ys: (number | null)[] = rows.map(() => null);
    const hit = rows.map(() => false);
    let sparks: Spark[] = [];
    const t0 = performance.now(), gap = 520, fall = 560;
    setLegend(0);
    const tick = (now: number) => {
      const t = now - t0;
      let done = 0;
      rows.forEach((_, i) => {
        const lt = t - 300 - i * gap;
        if (lt < 0) return;
        const p = Math.min(lt / fall, 1);
        const to = restY(i), from = -40;
        ys[i] = Math.round((from + (to - from) * p * p) / 2) * 2; // falls with gravity, snapped to 2px steps
        if (p >= 1) {
          ys[i] = to;
          done++;
          if (!hit[i]) {
            hit[i] = true;
            for (let k = 0; k < 10; k++)
              sparks.push({ x: CX + (Math.random() * 2 - 1) * A, y: to + B * 0.9, vx: (Math.random() - 0.5) * 0.8, vy: -Math.random() * 1.2, life: 1 });
            setLegend(i + 1);
          }
        }
      });
      sparks.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life -= 0.03;
      });
      sparks = sparks.filter((p) => p.life > 0);
      frame(ys, sparks);
      if (done < rows.length || sparks.length) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalFrame, frame, rows, setLegend]);

  useSchemeChange(finalFrame);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          play();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(cv);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, [play]);

  const names = rows.map((r) => `${r.category}: ${r.name}`).join(", ");
  return (
    <figure className="bp-plate bp-stack" aria-labelledby="bp-fig1">
      <div className="bp-fig">
        <span id="bp-fig1">Fig. 1 · {call}</span>
        <span aria-hidden="true">1:1</span>
      </div>
      <canvas ref={canvas} className="bp-stack-canvas" width={W} height={H} role="img" aria-label={`Pixel drawing of the answer as stacked layers. ${names}.`} />
      <ol className="bp-legend" ref={legend}>
        {rows.map((r, i) => (
          <li key={r.category} title={r.reason}>
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <span>{r.category}</span>
            <b>{r.name}</b>
          </li>
        ))}
      </ol>
      <div className="bp-stack-foot">
        <strong>{cost}</strong>
        <button className="bp-replay" type="button" onClick={play}>
          Replay
        </button>
      </div>
    </figure>
  );
}
