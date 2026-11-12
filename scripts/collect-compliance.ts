/**
 * Reads each vendor's compliance pages (src/catalog/compliance-sources.ts) and keeps
 * data/compliance.json in step with them: whether the vendor signs a HIPAA BAA,
 * offers a GDPR DPA, lets you keep data in the EU, and has a SOC 2 report.
 *
 * For a tool whose pages changed since the last read (data/compliance/<slug>.json),
 * Claude answers the four questions from the pages' lines, quoting the vendor's own
 * sentence for each. src/freshness/compliance.ts decides what is published: the
 * quote has to be on the page as read today and be about the topic. Anything else
 * is left as it was and written to the report for a person.
 *
 * Needs ANTHROPIC_API_KEY. Without it (or with --no-model) the pages are read and
 * reported, and nothing is changed.
 *
 * Usage: npx tsx scripts/collect-compliance.ts [--only <slug,slug>] [--report <file>] [--dry-run] [--no-model] [--html-dir <dir>]
 *   --only      re-read these tools' facts, whether or not their pages changed
 *   --no-model  only check that the listed pages load and have something to read
 *   --html-dir  read <dir>/<slug>-<n>.html (n = 1 for the tool's first page) instead of fetching, when it exists
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { tools } from "@/catalog";
import { COMPLIANCE_SOURCES } from "@/catalog/compliance-sources";
import {
  complianceLines, decideCompliance, samePages, type ComplianceFile, type ComplianceProposal, type ComplianceSnapshot,
} from "@/freshness/compliance";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIR = path.join(ROOT, "data", "compliance");
const FILE = path.join(ROOT, "data", "compliance.json");
const MODEL = "claude-opus-5-5";
const USER_AGENT = "Mozilla/5.0 (compatible; CuelyFreshness/1.0; +https://cuely.dev)";
const TIMEOUT_MS = 25_000;
const FETCHES = 6;
const MODEL_CALLS = 4;

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
};
const reportPath = arg("--report");
const only = arg("--only")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const dryRun = process.argv.includes("--dry-run");
const noModel = process.argv.includes("--no-model");
const htmlDir = arg("--html-dir");
const today = new Date().toISOString().slice(0, 10);

type Page = { ok: true; html: string } | { ok: false; error: string };

const fetched = new Map<string, Promise<Page>>();
/** One fetch per URL, even when several tools share a page. */
function fetchPage(url: string): Promise<Page> {
  let page = fetched.get(url);
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
    fetched.set(url, page);
  }
  return page;
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

type Tool = (typeof tools)[number];

interface Read {
  tool: Tool;
  pages: ComplianceSnapshot["pages"];
  /** Pages that didn't load or had nothing on these topics, with why. */
  unread: { url: string; why: string }[];
  before: ComplianceSnapshot | null;
}

async function read(tool: Tool): Promise<Read> {
  const urls = COMPLIANCE_SOURCES[tool.slug];
  const pages: ComplianceSnapshot["pages"] = [];
  const unread: Read["unread"] = [];
  for (const [i, url] of urls.entries()) {
    const saved = htmlDir ? path.join(htmlDir, `${tool.slug}-${i + 1}.html`) : null;
    const page: Page = saved && existsSync(saved) ? { ok: true, html: readFileSync(saved, "utf8") } : await fetchPage(url);
    if (!page.ok) {
      unread.push({ url, why: page.error });
      continue;
    }
    const lines = complianceLines(page.html);
    if (lines.length === 0) unread.push({ url, why: "loaded, but nothing on these topics (the page may need a browser to render)" });
    else pages.push({ url, lines });
  }
  const file = path.join(DIR, `${tool.slug}.json`);
  const before = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ComplianceSnapshot) : null;
  return { tool, pages, unread, before };
}

const Answer = z.object({
  answer: z.enum(["yes", "plan", "no", "unstated"]),
  detail: z.string(),
  quote: z.string(),
  source: z.string(),
});
const ProposalSchema = z.object({ baa: Answer, dpa: Answer, eu_region: Answer, soc2: Answer });

const SYSTEM = `You read a software vendor's own compliance pages for a catalog that developers use to choose tools for products with sensitive data. A wrong "yes" could lead someone to put patient data somewhere it can't legally go, so answer only what the lines state.

You are given one tool and the lines of its vendor's pages that touch compliance, grouped by page (each group starts with "=== Page:" and the page's URL). Answer four questions about that tool specifically (a vendor's page may cover several products; an answer about another product is not an answer about this one):

- baa: does the vendor sign a HIPAA business associate agreement (BAA) for this tool?
- dpa: does the vendor offer a GDPR data processing agreement or addendum (DPA)?
- eu_region: can a customer keep this tool's data in an EU region?
- soc2: does the vendor state it has a SOC 2 report (Type I or II)?

For each, answer:
- "yes": the lines state it, with no plan restriction.
- "plan": the lines state it is offered only on certain plans, as a paid add-on, for enterprise customers, or on request to sales.
- "no": the lines state the vendor does not offer it (for example "we do not sign BAAs", or data is stored only in the US).
- "unstated": the lines don't say. Silence is never "no", and being "GDPR compliant" or "HIPAA ready" without saying a BAA or DPA is available is "unstated" for baa and dpa.

For every answer other than "unstated":
- quote: copy, word for word, a continuous part of ONE line (12 to 300 characters) that states it. It must name the thing itself (HIPAA or BAA; DPA or data processing; the EU, a European country or city, or region; SOC 2). Do not join lines, fix typos or paraphrase.
- source: the URL of the page that line is on, exactly as given.
- detail: one short sentence a developer needs: which plan or add-on, which EU regions, what is excluded. No marketing words.

For "unstated", leave quote, source and detail empty.`;

const client = new Anthropic();

async function ask(tool: Tool, pages: ComplianceSnapshot["pages"]): Promise<ComplianceProposal | { refused: string }> {
  const prompt = [
    `Tool: ${tool.name} (${tool.category}). ${tool.summary}`,
    "",
    ...pages.flatMap((p) => [`=== Page: ${p.url}`, ...p.lines, "=== End of page", ""]),
  ].join("\n");
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: zodOutputFormat(ProposalSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") return { refused: "The model declined to read these pages." };
  if (response.stop_reason === "max_tokens" || !response.parsed_output) return { refused: "The model's answer was cut off or unreadable." };
  return response.parsed_output;
}

const listed = Object.keys(COMPLIANCE_SOURCES);
const unknown = [...listed, ...(only ?? [])].filter((slug) => !tools.some((t) => t.slug === slug) || !COMPLIANCE_SOURCES[slug]);
if (unknown.length) {
  console.error(`No such tool, or no compliance pages listed for it: ${[...new Set(unknown)].join(", ")}`);
  process.exit(2);
}
const selected = tools.filter((t) => (only ? only.includes(t.slug) : listed.includes(t.slug)));
if (!dryRun) mkdirSync(DIR, { recursive: true });

const reads = await pool(selected, FETCHES, read);
const file = JSON.parse(readFileSync(FILE, "utf8")) as ComplianceFile;
const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const updated: string[] = [];
const confirmed: string[] = [];
const held: string[] = [];
const skipped: string[] = [];
let stop: string | null = null;
let wrote = false;

/** A page that was read last time and fails today isn't a change in what the vendor says: wait for it to load again. */
const lostPage = (r: Read) => r.before?.pages.some((p) => r.unread.some((u) => u.url === p.url)) ?? false;
const due = reads.filter((r) => r.pages.length > 0 && !lostPage(r) && (only !== null || !samePages(r.before?.pages, r.pages)));

if (noModel) {
  // Reachability only.
} else if (due.length && !hasKey) {
  held.push(...due.map((r) => `- \`${r.tool.slug}\`: not checked, because no ANTHROPIC_API_KEY reached the job (see the Infisical setup in the README).`));
} else {
  await pool(due, MODEL_CALLS, async (r) => {
    if (stop) return;
    try {
      const answer = await ask(r.tool, r.pages);
      if ("refused" in answer) {
        held.push(`- **${r.tool.name}**: ${answer.refused}`);
        return;
      }
      const decision = decideCompliance(file.tools[r.tool.slug], answer, r.pages, today);
      file.tools[r.tool.slug] = decision.compliance;
      if (!dryRun) {
        const snapshot: ComplianceSnapshot = { slug: r.tool.slug, readOn: today, pages: r.pages };
        writeFileSync(path.join(DIR, `${r.tool.slug}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
        wrote = true;
      }
      if (decision.changed.length) updated.push(`- **${r.tool.name}**: ${decision.changed.join(" ")}`);
      else confirmed.push(r.tool.name);
      for (const h of decision.held) held.push(`- **${r.tool.name}**, ${h}`);
    } catch (error) {
      // Credentials or a bad request won't fix themselves on the next tool: stop. Anything else, skip this tool until next week.
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError || error instanceof Anthropic.BadRequestError) {
        stop = `- The Claude API refused the request (${error.status}): ${error.message}. No further tools were checked.`;
        return;
      }
      if (error instanceof Anthropic.APIError) skipped.push(`- **${r.tool.name}**: the Claude API failed (${error.status ?? "connection"}); it will be read again next run.`);
      else throw error;
    }
  });
  if (stop) held.push(stop);
}

const unread = reads.flatMap((r) => r.unread.map((u) => ({ tool: r.tool.name, ...u })));
const unreadPages = [...new Map(unread.map((u) => [u.url, u])).values()];
const pagesRead = new Set(reads.flatMap((r) => r.pages.map((p) => p.url))).size;

const L: string[] = [
  `Compliance pages read on ${today}: ${selected.length} tools, ${pagesRead} pages read, ${unreadPages.length} could not be read. ${
    noModel ? "Pages only; no facts were re-read." : `${due.length} tools had changed pages: ${updated.length} updated, ${confirmed.length} confirmed, ${held.length} held for a person.`
  }`,
];
if (updated.length) L.push("", "## Updated", "", ...updated.sort());
if (confirmed.length) L.push("", "## Still correct", "", confirmed.sort().join(", "));
if (held.length) L.push("", "## Needs a person", "", ...held.sort());
if (skipped.length) L.push("", "## Skipped this run", "", ...skipped.sort());
if (unreadPages.length) {
  L.push("", "## Pages that could not be read", "", "| Tool | Page | Why |", "| --- | --- | --- |");
  for (const u of unreadPages) L.push(`| ${u.tool} | ${u.url} | ${u.why} |`);
}
const report = `${L.join("\n")}\n`;
console.log(report);
if (reportPath) writeFileSync(reportPath, report);

const sorted: ComplianceFile = { tools: Object.fromEntries(Object.entries(file.tools).sort(([a], [b]) => a.localeCompare(b))) };
const body = `${JSON.stringify(sorted, null, 2)}\n`;
const changed = body !== readFileSync(FILE, "utf8");
if (changed && !dryRun) writeFileSync(FILE, body);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${(changed || wrote) && !dryRun}\nheld=${held.length > 0}\n`);
if (stop) process.exitCode = 1;
