/**
 * Tool health: turns measured signals into the number the ranking uses.
 *
 * A scheduled job (scripts/collect-signals.ts) measures each tool and writes
 * data/signals.json. This file is the whole rule for what those numbers do to a
 * tool's score. It is deterministic and published; no person or model sets a
 * tool's health, and no vendor can pay to change it.
 *
 *   outages   = 0.25 × major incidents + 0.75 × critical incidents   (last 90 days, capped at 2.5)
 *   security  = 0.25 × high advisories + 0.5 × critical advisories   (last 180 days, capped at 1)
 *   adoption  = downloads in the last 28 days ÷ downloads in the 28 days ending 91 days ago − 1
 *               (capped to −1…+1; ignored under 1,000 downloads)
 *   health    = adoption − outages − security, capped to −3…+1, rounded to 0.1
 *
 * One rank in a category's default order is worth 0.4, so two major incidents, one
 * critical incident or a 40% drop in adoption is enough to hand a close pick to the
 * next tool. A signal that couldn't be measured is null and counts as zero.
 */
import type { ToolHealth } from "@/catalog/types";

export const OUTAGE_DAYS = 90;
export const ADVISORY_DAYS = 180;
export const ADOPTION_DAYS = 28;
/** The earlier adoption window ends this many days before the measurement. */
export const ADOPTION_GAP_DAYS = 91;
export const MIN_DOWNLOADS = 1000;

/** What was measured for one tool. null means the signal couldn't be read. */
export interface ToolSignals {
  /** Incidents on the vendor's status page in the last OUTAGE_DAYS, by the impact the vendor gave them. */
  incidents: { minor: number; major: number; critical: number; source: string } | null;
  /** Security advisories published for the tool's package in the last ADVISORY_DAYS. */
  advisories: { high: number; critical: number; package: string } | null;
  /** npm downloads of the tool's package in two ADOPTION_DAYS windows. */
  downloads: { recent: number; earlier: number; package: string } | null;
}

export interface SignalsFile {
  /** Date of the last measurement (YYYY-MM-DD), or null before the first one. */
  measuredOn: string | null;
  tools: Record<string, ToolSignals>;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The health a tool's signals work out to, or undefined when nothing was measured. */
export function healthFrom(signals: ToolSignals | undefined, measuredOn: string | null): ToolHealth | undefined {
  if (!signals || !measuredOn) return undefined;
  const { incidents, advisories, downloads } = signals;
  if (!incidents && !advisories && !downloads) return undefined;
  const against: string[] = [];
  const inFavor: string[] = [];

  let outages = 0;
  if (incidents && incidents.major + incidents.critical > 0) {
    outages = Math.min(2.5, 0.25 * incidents.major + 0.75 * incidents.critical);
    const parts = [
      incidents.critical ? plural(incidents.critical, "critical incident") : null,
      incidents.major ? plural(incidents.major, "major incident") : null,
    ].filter(Boolean);
    against.push(`${parts.join(" and ")} on its status page in the last ${OUTAGE_DAYS} days (${incidents.source}).`);
  }

  let security = 0;
  if (advisories && advisories.high + advisories.critical > 0) {
    security = Math.min(1, 0.25 * advisories.high + 0.5 * advisories.critical);
    const parts = [
      advisories.critical ? plural(advisories.critical, "critical security advisory", "critical security advisories") : null,
      advisories.high ? plural(advisories.high, "high-severity security advisory", "high-severity security advisories") : null,
    ].filter(Boolean);
    against.push(`${parts.join(" and ")} for ${advisories.package} in the last ${ADVISORY_DAYS} days.`);
  }

  // Changes under 10% are noise and move nothing.
  let adoption = 0;
  if (downloads && downloads.earlier >= MIN_DOWNLOADS) {
    const change = clamp(downloads.recent / downloads.earlier - 1, -1, 1);
    if (Math.abs(change) >= 0.1) {
      adoption = change;
      const line = `Downloads of ${downloads.package} ${change > 0 ? "rose" : "fell"} ${Math.round(Math.abs(change) * 100)}% over three months.`;
      (change > 0 ? inFavor : against).push(line);
    }
  }

  const score = round1(clamp(adoption - outages - security, -3, 1));
  // Lead with the side that decided the sign.
  const reasons = score > 0 ? [...inFavor, ...against] : [...against, ...inFavor];
  return { score, reasons, measuredOn };
}

const DAY = 86_400_000;

/** Counts a Statuspage /api/v2/incidents.json body's incidents from the last OUTAGE_DAYS, or null if it isn't one. */
export function countIncidents(body: unknown, now: Date): { minor: number; major: number; critical: number } | null {
  const list = (body as { incidents?: unknown })?.incidents;
  if (!Array.isArray(list)) return null;
  const since = now.getTime() - OUTAGE_DAYS * DAY;
  const out = { minor: 0, major: 0, critical: 0 };
  for (const i of list as { impact?: string; created_at?: string }[]) {
    const at = Date.parse(i.created_at ?? "");
    if (!Number.isFinite(at) || at < since || at > now.getTime()) continue;
    if (i.impact === "minor" || i.impact === "major" || i.impact === "critical") out[i.impact]++;
  }
  return out;
}

/** Counts an OSV /v1/query body's high and critical advisories published in the last ADVISORY_DAYS, or null if it isn't one. */
export function countAdvisories(body: unknown, now: Date): { high: number; critical: number } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const list = (body as { vulns?: unknown }).vulns ?? [];
  if (!Array.isArray(list)) return null;
  const since = now.getTime() - ADVISORY_DAYS * DAY;
  const out = { high: 0, critical: 0 };
  for (const v of list as { published?: string; withdrawn?: string; database_specific?: { severity?: string } }[]) {
    if (v.withdrawn) continue;
    const at = Date.parse(v.published ?? "");
    if (!Number.isFinite(at) || at < since) continue;
    const severity = v.database_specific?.severity?.toUpperCase();
    if (severity === "HIGH") out.high++;
    else if (severity === "CRITICAL") out.critical++;
  }
  return out;
}

/** The two npm download windows, as YYYY-MM-DD ranges. npm's counts lag by up to two days. */
export function downloadWindows(now: Date): { recent: [string, string]; earlier: [string, string] } {
  const day = (back: number) => new Date(now.getTime() - back * DAY).toISOString().slice(0, 10);
  return {
    recent: [day(ADOPTION_DAYS + 1), day(2)],
    earlier: [day(ADOPTION_GAP_DAYS + ADOPTION_DAYS + 1), day(ADOPTION_GAP_DAYS + 2)],
  };
}
