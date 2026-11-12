/**
 * Re-reads the price and limit facts of every tool whose pricing page changed, and
 * rewrites data/facts.json. Runs after scripts/check-pricing.ts in the weekly job.
 *
 * Claude reads the page's price lines next to the catalog's current wording and
 * proposes the new wording; src/freshness/facts.ts decides whether it is published
 * (every quoted amount must be on the page, no large cost jump). What it holds back
 * is written to the report for a person.
 *
 * Needs ANTHROPIC_API_KEY. Without it nothing is changed and the report says so.
 *
 * Usage: npx tsx scripts/update-facts.ts (--changes <file> | --only <slug,slug>) [--report <file>] [--dry-run]
 *   --changes  JSON written by check-pricing.ts --changes: [{ slug, added, removed }]
 *   --only     check these tools against their last-read snapshot, whether or not the page changed
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { COST_PROFILE, tools } from "@/catalog";
import { decide, factsOf, type FactsFile, type Proposal } from "@/freshness/facts";
import type { PricingSnapshot } from "@/freshness/pricing";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILE = path.join(ROOT, "data", "facts.json");
const MODEL = "claude-opus-5-5";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
};
const changesPath = arg("--changes");
const reportPath = arg("--report");
const dryRun = process.argv.includes("--dry-run");
const today = new Date().toISOString().slice(0, 10);

const only = arg("--only")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
if (!only && (!changesPath || !existsSync(changesPath))) {
  console.error("Pass --changes <file> (written by check-pricing.ts --changes) or --only <slug,slug>.");
  process.exit(2);
}
const changes = only
  ? only.map((slug) => ({ slug, added: [] as string[], removed: [] as string[] }))
  : (JSON.parse(readFileSync(changesPath!, "utf8")) as { slug: string; added: string[]; removed: string[] }[]);

const ProposalSchema = z.object({
  verdict: z.enum(["unchanged", "update", "unsure"]),
  freeTier: z.string().nullable(),
  paidStartsAt: z.string().nullable(),
  cost: z.object({ monthly: z.number().nullable(), basis: z.string(), variable: z.string().nullable() }).nullable(),
  note: z.string(),
});

const SYSTEM = `You keep the price and limit facts of a developer-tool catalog in step with each vendor's pricing page.

You are given one tool: the catalog's current facts, the lines of the vendor's pricing page that state a price or a limit (read today), and which of those lines were added or removed since the last read. The catalog's readers choose tools on these facts, so a wrong price is worse than an old one.

Decide one of:
- "unchanged": everything the current facts state is still what the page says. Lines can change without the facts changing (other plans, wording, add-ons the facts don't mention).
- "update": the page now states a different price or limit for something the current facts state. Return all three facts in full, changing only what the page changed and keeping the catalog's wording and level of detail everywhere else.
- "unsure": the lines don't let you tell (the plan the facts describe is missing, the lines are ambiguous, or the page looks only partly read). Say what a person should check.

Rules for an update:
- Quote only amounts and limits that appear in the page lines. Never estimate or carry over a number you can't see.
- freeTier describes the free plan's limits, or is null when there is no free plan. paidStartsAt describes the cheapest paid option.
- cost is the monthly cost at the usage profile given, with the arithmetic in "basis" in one line so someone can redo it for other numbers. Change it only when the price change moves it. "variable" is for fees that scale with revenue; null when there are none.
- note is one sentence on what changed.`;

const client = new Anthropic();

async function ask(tool: (typeof tools)[number], lines: string[], added: string[], removed: string[]): Promise<Proposal | { refused: string }> {
  const facts = factsOf(tool);
  const prompt = [
    `Tool: ${tool.name} (${tool.category}). Pricing page: ${tool.pricingUrl}`,
    `Usage profile for cost: ${tool.cost?.scale === "10_staff" ? `${COST_PROFILE.internalStaff} staff` : COST_PROFILE.text}`,
    "",
    "<current_facts>",
    JSON.stringify(facts, null, 2),
    "</current_facts>",
    "",
    "<page_lines>",
    ...lines,
    "</page_lines>",
    "",
    "<removed_since_last_read>",
    ...removed,
    "</removed_since_last_read>",
    "",
    "<added_since_last_read>",
    ...added,
    "</added_since_last_read>",
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
  if (response.stop_reason === "refusal") return { refused: "The model declined to read this page." };
  if (response.stop_reason === "max_tokens" || !response.parsed_output) return { refused: "The model's answer was cut off or unreadable." };
  const p = response.parsed_output;
  return {
    verdict: p.verdict,
    freeTier: p.freeTier,
    paidStartsAt: p.paidStartsAt,
    cost: p.cost ? { monthly: p.cost.monthly, basis: p.cost.basis, ...(p.cost.variable ? { variable: p.cost.variable } : {}) } : null,
    note: p.note,
  };
}

const file = JSON.parse(readFileSync(FILE, "utf8")) as FactsFile;
const published: string[] = [];
const confirmed: string[] = [];
const held: string[] = [];
let failed = false;

if (changes.length === 0) {
  console.log("No pricing page changed; facts left as they are.");
} else if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  held.push(...changes.map((c) => `- \`${c.slug}\`: not checked, because the ANTHROPIC_API_KEY secret isn't set.`));
} else {
  for (const change of changes) {
    const tool = tools.find((t) => t.slug === change.slug);
    const snapshotFile = path.join(ROOT, "data", "pricing", `${change.slug}.json`);
    if (!tool || !existsSync(snapshotFile)) {
      held.push(`- \`${change.slug}\`: no such tool, or its pricing page has never been read.`);
      continue;
    }
    const { lines } = JSON.parse(readFileSync(snapshotFile, "utf8")) as PricingSnapshot;
    try {
      const answer = await ask(tool, lines, change.added, change.removed);
      if ("refused" in answer) {
        held.push(`- **${tool.name}** (${tool.pricingUrl}): ${answer.refused}`);
        continue;
      }
      const decision = decide(factsOf(tool), answer, lines, today);
      if (decision.action === "hold") {
        held.push(`- **${tool.name}** (${tool.pricingUrl}): ${decision.why}`);
        continue;
      }
      file.tools[tool.slug] = { ...file.tools[tool.slug], ...decision.update };
      if (decision.action === "publish") published.push(`- **${tool.name}**: ${answer.note}`);
      else confirmed.push(tool.name);
    } catch (error) {
      // Credentials or a bad request won't fix themselves on the next tool: stop. Anything else, hold this tool and go on.
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError || error instanceof Anthropic.BadRequestError) {
        held.push(`- The Claude API refused the request (${error.status}): ${error.message}. No further tools were checked.`);
        failed = true;
        break;
      }
      if (error instanceof Anthropic.APIError) held.push(`- **${tool.name}** (${tool.pricingUrl}): the Claude API failed (${error.status ?? "connection"}); it will be retried when the page next changes.`);
      else throw error;
    }
  }
}

const L: string[] = [`Facts checked on ${today}: ${changes.length} changed pages, ${published.length} updated, ${confirmed.length} confirmed unchanged, ${held.length} held for a person.`];
if (published.length) L.push("", "## Updated", "", ...published);
if (confirmed.length) L.push("", "## Still correct", "", confirmed.join(", "));
if (held.length) L.push("", "## Needs a person", "", ...held);
const report = `${L.join("\n")}\n`;
console.log(report);
if (reportPath) writeFileSync(reportPath, report);

const sorted: FactsFile = { tools: Object.fromEntries(Object.entries(file.tools).sort(([a], [b]) => a.localeCompare(b))) };
const body = `${JSON.stringify(sorted, null, 2)}\n`;
const changed = body !== readFileSync(FILE, "utf8");
if (changed && !dryRun) writeFileSync(FILE, body);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed && !dryRun}\nheld=${held.length > 0}\n`);
if (failed) process.exitCode = 1;
