/**
 * Reads every tool's pricing page and compares its price and limit lines with the
 * last read (data/pricing/<slug>.json). Rewrites a snapshot only when its lines
 * changed, and prints a report of what changed and which amounts quoted in the
 * catalog are no longer on the page.
 *
 * It never edits the catalog's facts: scripts/update-facts.ts does that for the pages
 * this reports as changed.
 *
 * Usage: npx tsx scripts/check-pricing.ts [--report <file>] [--changes <file>] [--only <slug,slug>] [--dry-run] [--html-dir <dir>]
 *
 * --changes writes the changed tools as JSON ([{ slug, added, removed }]) for scripts/update-facts.ts.
 *
 * --html-dir reads <dir>/<slug>.html when it exists instead of fetching, for pages
 * that only render in a browser (save the page there by hand or from a browser run).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tools } from "@/catalog";
import { MIN_READABLE_LINES, diffLines, missingAmounts, priceLines, type PricingSnapshot } from "@/freshness/pricing";

const DIR = path.resolve(import.meta.dirname, "..", "data", "pricing");
const USER_AGENT = "Mozilla/5.0 (compatible; CuelyFreshness/1.0; +https://cuely.dev)";
const TIMEOUT_MS = 25_000;
const CONCURRENCY = 6;

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
};
const reportPath = arg("--report");
const changesPath = arg("--changes");
const only = arg("--only")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const dryRun = process.argv.includes("--dry-run");
const htmlDir = arg("--html-dir");
const today = new Date().toISOString().slice(0, 10);

type Page = { ok: true; html: string } | { ok: false; error: string };

const pages = new Map<string, Promise<Page>>();
/** One fetch per URL, even when several tools share a pricing page. */
function fetchPage(url: string): Promise<Page> {
  let page = pages.get(url);
  if (!page) {
    page = (async (): Promise<Page> => {
      try {
        const res = await fetch(url, {
          redirect: "follow",
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml", "accept-language": "en-US,en" },
        });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        return { ok: true, html: await res.text() };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    })();
    pages.set(url, page);
  }
  return page;
}

function readSnapshot(slug: string): PricingSnapshot | null {
  const file = path.join(DIR, `${slug}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as PricingSnapshot) : null;
}

interface Result {
  slug: string;
  name: string;
  url: string;
  verifiedOn: string;
  status: "unchanged" | "changed" | "new" | "unreadable" | "error";
  detail?: string;
  added: string[];
  removed: string[];
  missing: string[];
}

async function check(tool: (typeof tools)[number]): Promise<Result> {
  const base = { slug: tool.slug, name: tool.name, url: tool.pricingUrl, verifiedOn: tool.verifiedOn, added: [], removed: [], missing: [] };
  const saved = htmlDir ? path.join(htmlDir, `${tool.slug}.html`) : null;
  const page: Page = saved && existsSync(saved) ? { ok: true, html: readFileSync(saved, "utf8") } : await fetchPage(tool.pricingUrl);
  if (!page.ok) return { ...base, status: "error", detail: page.error };
  const lines = priceLines(page.html);
  if (lines.length < MIN_READABLE_LINES) {
    return { ...base, status: "unreadable", detail: `${lines.length} price lines; the page likely needs a browser to render` };
  }
  const missing = missingAmounts([tool.freeTier, tool.paidStartsAt], page.html);
  const before = readSnapshot(tool.slug);
  const { added, removed } = diffLines(before?.lines ?? [], lines);
  const moved = before?.url !== tool.pricingUrl;
  if (before && !moved && added.length === 0 && removed.length === 0) return { ...base, status: "unchanged", missing };
  if (!dryRun) {
    const snapshot: PricingSnapshot = { slug: tool.slug, url: tool.pricingUrl, readOn: today, lines };
    writeFileSync(path.join(DIR, `${tool.slug}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
  }
  return before ? { ...base, status: "changed", added, removed, missing } : { ...base, status: "new", missing };
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

const quote = (lines: string[], mark: string) => lines.map((l) => `${mark} ${l}`).join("\n");

function render(results: Result[]): string {
  const by = (s: Result["status"]) => results.filter((r) => r.status === s);
  const changed = by("changed");
  const fresh = by("new");
  const stale = results.filter((r) => r.missing.length > 0);
  const unread = [...by("unreadable"), ...by("error")];
  const out: string[] = [];
  out.push(`Pricing pages read on ${today}: ${results.length} tools, ${changed.length} changed, ${fresh.length} read for the first time, ${by("unchanged").length} unchanged, ${unread.length} could not be read.`);

  if (changed.length) {
    out.push("", "## Pages that changed");
    for (const r of changed) {
      out.push("", `### ${r.name} (\`${r.slug}\`)`, `${r.url}, catalog last verified ${r.verifiedOn}`, "", "```diff");
      if (r.removed.length) out.push(quote(r.removed, "-"));
      if (r.added.length) out.push(quote(r.added, "+"));
      out.push("```");
    }
  }
  if (stale.length) {
    out.push("", "## Amounts the catalog quotes that are not on the page", "", "| Tool | Not found on the page | Catalog verified | Page |", "| --- | --- | --- | --- |");
    for (const r of stale) out.push(`| ${r.name} | ${r.missing.join(", ")} | ${r.verifiedOn} | ${r.url} |`);
  }
  if (fresh.length) {
    out.push("", "## Read for the first time", "", fresh.map((r) => `\`${r.slug}\``).join(", "));
  }
  if (unread.length) {
    out.push("", "## Could not be read (check these by hand)", "", "| Tool | Why | Page |", "| --- | --- | --- |");
    for (const r of unread) out.push(`| ${r.name} | ${r.detail ?? r.status} | ${r.url} |`);
  }
  return `${out.join("\n")}\n`;
}

const selected = only ? tools.filter((t) => only.includes(t.slug)) : tools;
if (only && selected.length !== only.length) {
  const known = new Set(selected.map((t) => t.slug));
  console.error(`Unknown tool slug: ${only.filter((s) => !known.has(s)).join(", ")}`);
  process.exit(2);
}
if (!dryRun) mkdirSync(DIR, { recursive: true });

const results = await pool(selected, CONCURRENCY, check);
const report = render(results);
console.log(report);
if (reportPath) writeFileSync(reportPath, report);
if (changesPath) {
  const changed = results.filter((r) => r.status === "changed").map(({ slug, added, removed }) => ({ slug, added, removed }));
  writeFileSync(changesPath, `${JSON.stringify(changed, null, 2)}\n`);
}

const wrote = results.some((r) => r.status === "changed" || r.status === "new");
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${wrote && !dryRun}\n`);
