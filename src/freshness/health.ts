/**
 * Tool health: turns measured signals into the number the ranking uses.
 *
 * A scheduled job (scripts/collect-signals.ts) measures each tool and writes
 * data/signals.json. This file is the whole rule for what those numbers do to a
 * tool's score. It is deterministic and published; no person or model sets a
 * tool's health, and no vendor can pay to change it.
 *
 *   incident points = 0.25 × major incidents + 0.75 × critical incidents   (last 90 days)
 *   outages   = incident points − the typical vendor's incident points      (never below 0, capped at 1.2)
 *   security  = 0.25 × high advisories + 0.5 × critical advisories          (last 180 days, capped at 1)
 *   growth    = downloads in the last 28 days ÷ downloads in the 28 days ending 91 days ago
 *   adoption  = growth ÷ the typical package's growth − 1
 *               (capped to −0.5…+0.5; ignored under a 10% gap or under 1,000 downloads)
 *   health    = adoption − outages − security, rounded to 0.1
 *
 * "Typical" is the median across everything Cuely measured that day (normsOf). Every
 * tool is judged against it because vendors differ in how readily they post incidents,
 * and npm downloads rise and fall for the whole market at once; a tool only moves when
 * it does better or worse than the rest. A signal that couldn't be measured is null and
 * counts as typical, so a vendor is never rewarded for having no readable status page.
 *
 * One rank in a category's default order is worth 0.4, so two major incidents or one
 * critical incident more than the typical vendor is enough to hand a close pick to the
 * next tool.
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

/** What a typical measured tool looks like on one day; each tool's health is judged against it. */
export interface Norms {
  /** Median incident points across the status pages that were read. */
  incidentPoints: number;
  /** Median download growth (recent ÷ earlier) across the packages that were read. */
  growth: number;
}

/** Judges a tool on its own numbers alone. Used until enough tools are measured to say what is typical. */
export const NO_NORMS: Norms = { incidentPoints: 0, growth: 1 };
/** Fewer measurements than this can't say what is typical. */
export const MIN_FOR_NORMS = 5;
export const MAX_OUTAGES = 1.2;
export const MAX_ADOPTION = 0.5;

const incidentPoints = (i: { major: number; critical: number }) => 0.25 * i.major + 0.75 * i.critical;

function median(values: number[]): number | null {
  if (values.length < MIN_FOR_NORMS) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** The typical incident points and download growth in one measurement. Each status page and package counts once. */
export function normsOf(file: SignalsFile): Norms {
  const pages = new Map<string, number>();
  const packages = new Map<string, number>();
  for (const s of Object.values(file.tools)) {
    if (s.incidents) pages.set(s.incidents.source, incidentPoints(s.incidents));
    if (s.downloads && s.downloads.earlier >= MIN_DOWNLOADS) packages.set(s.downloads.package, s.downloads.recent / s.downloads.earlier);
  }
  return {
    incidentPoints: median([...pages.values()]) ?? NO_NORMS.incidentPoints,
    growth: median([...packages.values()]) || NO_NORMS.growth,
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The health a tool's signals work out to, or undefined when nothing was measured. */
export function healthFrom(signals: ToolSignals | undefined, measuredOn: string | null, norms: Norms = NO_NORMS): ToolHealth | undefined {
  if (!signals || !measuredOn) return undefined;
  const { incidents, advisories, downloads } = signals;
  if (!incidents && !advisories && !downloads) return undefined;
  const against: string[] = [];
  const inFavor: string[] = [];

  let outages = 0;
  if (incidents && incidentPoints(incidents) > norms.incidentPoints) {
    outages = Math.min(MAX_OUTAGES, incidentPoints(incidents) - norms.incidentPoints);
    const parts = [
      incidents.critical ? plural(incidents.critical, "critical incident") : null,
      incidents.major ? plural(incidents.major, "major incident") : null,
    ].filter(Boolean);
    const typical = norms.incidentPoints > 0 ? ", more than the typical vendor Cuely tracks" : "";
    against.push(`${parts.join(" and ")} on its status page in the last ${OUTAGE_DAYS} days${typical} (${incidents.source}).`);
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

  // Gaps under 10% are noise and move nothing.
  let adoption = 0;
  if (downloads && downloads.earlier >= MIN_DOWNLOADS) {
    const growth = downloads.recent / downloads.earlier;
    const gap = clamp(growth / norms.growth - 1, -MAX_ADOPTION, MAX_ADOPTION);
    if (Math.abs(gap) >= 0.1) {
      adoption = gap;
      const moved = (g: number) => `${g >= 1 ? "rose" : "fell"} ${Math.round(Math.abs(g - 1) * 100)}%`;
      const typical = norms.growth !== 1 ? `; the typical package Cuely tracks ${moved(norms.growth)}` : "";
      (gap > 0 ? inFavor : against).push(`Downloads of ${downloads.package} ${moved(growth)} over three months${typical}.`);
    }
  }

  const score = round1(adoption - outages - security);
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
