/**
 * Measures every tool's health signals and rewrites data/signals.json:
 * incidents from the vendor's status page, security advisories for its package
 * (OSV), and npm downloads in two windows. src/freshness/health.ts turns those
 * numbers into the health that moves a tool's score.
 *
 * No model is involved and nothing here is editorial. A source that fails keeps
 * its last measured value, so one bad fetch can't move a ranking. If too many
 * fail at once the run stops without writing anything.
 *
 * Usage: npx tsx scripts/collect-signals.ts [--report <file>] [--dry-run]
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tools } from "@/catalog";
import { SOURCES } from "@/catalog/sources";
import {
  countAdvisories, countIncidents, downloadWindows, healthFrom, type SignalsFile, type ToolSignals,
} from "@/freshness/health";

const FILE = path.resolve(import.meta.dirname, "..", "data", "signals.json");
const USER_AGENT = "Mozilla/5.0 (compatible; CuelyFreshness/1.0; +https://cuely.dev)";
const TIMEOUT_MS = 20_000;
/** Stop without writing when more than this share of sources can't be read. */
const MAX_FAILED_SHARE = 0.4;

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
};
const reportPath = arg("--report");
const dryRun = process.argv.includes("--dry-run");
const now = new Date();
const today = now.toISOString().slice(0, 10);

const cache = new Map<string, Promise<unknown>>();
/** JSON from a URL, or null on any failure. One request per distinct call, shared between tools. */
function getJson(url: string, init?: { method: string; body: string }): Promise<unknown> {
  const key = `${url} ${init?.body ?? ""}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(url, {
            ...init,
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { "user-agent": USER_AGENT, accept: "application/json", ...(init ? { "content-type": "application/json" } : {}) },
          });
          if (res.ok) return await res.json();
          if (res.status < 500 && res.status !== 429) return null;
        } catch {
          // retried below
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      return null;
    })();
    cache.set(key, hit);
  }
  return hit;
}

async function downloads(pkg: string, [from, to]: [string, string]): Promise<number | null> {
  const body = (await getJson(`https://api.npmjs.org/downloads/point/${from}:${to}/${pkg}`)) as { downloads?: unknown } | null;
  return typeof body?.downloads === "number" ? body.downloads : null;
}

const previous = JSON.parse(readFileSync(FILE, "utf8")) as SignalsFile;
const failed: string[] = [];
let attempted = 0;

async function measure(slug: string): Promise<ToolSignals | null> {
  const src = SOURCES[slug];
  if (!src) return null;
  const before = previous.tools[slug];
  const out: ToolSignals = { incidents: null, advisories: null, downloads: null };

  if (src.status) {
    attempted++;
    const counts = countIncidents(await getJson(`${src.status}/api/v2/incidents.json`), now);
    if (counts) out.incidents = { ...counts, source: src.status };
    else {
      failed.push(`${slug}: status page ${src.status}`);
      out.incidents = before?.incidents ?? null;
    }
  }
  if (src.npm) {
    attempted += 2;
    const counts = countAdvisories(
      await getJson("https://api.osv.dev/v1/query", { method: "POST", body: JSON.stringify({ package: { name: src.npm, ecosystem: "npm" } }) }),
      now,
    );
    if (counts) out.advisories = { ...counts, package: src.npm };
    else {
      failed.push(`${slug}: advisories for ${src.npm}`);
      out.advisories = before?.advisories ?? null;
    }
    const w = downloadWindows(now);
    const [recent, earlier] = await Promise.all([downloads(src.npm, w.recent), downloads(src.npm, w.earlier)]);
    if (recent !== null && earlier !== null) out.downloads = { recent, earlier, package: src.npm };
    else {
      failed.push(`${slug}: downloads of ${src.npm}`);
      out.downloads = before?.downloads ?? null;
    }
  }
  return out;
}

const next: SignalsFile = { measuredOn: today, tools: {} };
// One tool at a time: the public APIs here rate-limit bursts.
for (const tool of tools) {
  const s = await measure(tool.slug);
  if (s) next.tools[tool.slug] = s;
}

const failedShare = attempted ? failed.length / attempted : 1;
const L: string[] = [];
L.push(`Signals measured on ${today}: ${Object.keys(next.tools).length} tools, ${attempted} sources read, ${failed.length} failed.`);

const moves: string[] = [];
for (const tool of tools) {
  const was = healthFrom(previous.tools[tool.slug], previous.measuredOn)?.score ?? 0;
  const h = healthFrom(next.tools[tool.slug], today);
  const is = h?.score ?? 0;
  if (was !== is) moves.push(`| ${tool.name} | ${tool.category} | ${was} | ${is} | ${h?.reasons.join(" ") ?? ""} |`);
}
if (moves.length) L.push("", "## Health that changed", "", "| Tool | Category | Was | Now | Why |", "| --- | --- | --- | --- | --- |", ...moves);
if (failed.length) L.push("", "## Sources that couldn't be read (last value kept)", "", ...failed.map((f) => `- ${f}`));

const tooMany = failedShare > MAX_FAILED_SHARE;
if (tooMany) L.push("", `Stopped without writing: ${Math.round(failedShare * 100)}% of sources failed, which looks like a network problem and not real change.`);
const report = `${L.join("\n")}\n`;
console.log(report);
if (reportPath) writeFileSync(reportPath, report);

const body = `${JSON.stringify(next, null, 2)}\n`;
const changed = !tooMany && body !== readFileSync(FILE, "utf8");
if (changed && !dryRun) writeFileSync(FILE, body);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed && !dryRun}\n`);
if (tooMany) process.exit(1);
