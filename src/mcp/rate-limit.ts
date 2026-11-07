/**
 * Fixed-window rate limiter keyed by client IP. In-memory per function
 * instance: good enough to blunt abuse on day one. A shared store (Upstash,
 * Postgres) can replace it later behind the same interface.
 */
export interface RateLimiter {
  check(key: string, now?: number): { ok: boolean; remaining: number; resetSeconds: number };
}

export function createRateLimiter(limitPerWindow: number, windowMs = 60_000): RateLimiter {
  const hits = new Map<string, { count: number; start: number }>();
  let lastSweep = 0;
  return {
    check(key, now = Date.now()) {
      if (now - lastSweep > windowMs) {
        for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
        lastSweep = now;
      }
      let entry = hits.get(key);
      if (!entry || now - entry.start >= windowMs) {
        entry = { count: 0, start: now };
        hits.set(key, entry);
      }
      entry.count += 1;
      const resetSeconds = Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000));
      return { ok: entry.count <= limitPerWindow, remaining: Math.max(0, limitPerWindow - entry.count), resetSeconds };
    },
  };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
