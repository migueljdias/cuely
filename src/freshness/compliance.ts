/**
 * Compliance facts: what each vendor's own pages say about four things a builder
 * with sensitive data has to know before choosing it.
 *
 *   baa        signs a HIPAA business associate agreement
 *   dpa        offers a GDPR data processing agreement
 *   eu_region  lets you keep the data in the EU
 *   soc2       has a SOC 2 report
 *
 * The daily job (scripts/collect-compliance.ts) reads the pages listed in
 * src/catalog/compliance-sources.ts and stores the lines that touch these topics
 * under data/compliance/<slug>.json. When a tool's lines change, a model answers
 * the four questions from them, and this file decides what is published to
 * data/compliance.json: an answer only counts when it quotes a line that is on the
 * page as read that day and the quote is about the topic. Anything else stays as it
 * was and is reported for a person.
 *
 * A fact that is absent means the pages Cuely reads don't say. It never means "no".
 *
 * Pure functions only, so they can be tested without the network.
 */
import type { CategorySlug, ComplianceFact, ComplianceTopic, Need, Tool, ToolCompliance } from "@/catalog/types";
import { htmlToLines } from "./pricing";

export const TOPICS: ComplianceTopic[] = ["baa", "dpa", "eu_region", "soc2"];

export const TOPIC_LABELS: Record<ComplianceTopic, string> = {
  baa: "HIPAA BAA",
  dpa: "GDPR data processing agreement",
  eu_region: "EU data region",
  soc2: "SOC 2",
};

/** What is stored per tool under data/compliance/<slug>.json. */
export interface ComplianceSnapshot {
  slug: string;
  /** Date (YYYY-MM-DD) the lines below were last seen to change. */
  readOn: string;
  pages: { url: string; lines: string[] }[];
}

export interface ComplianceFile {
  tools: Record<string, ToolCompliance>;
}

/** A quote has to contain one of these to count as being about its topic. */
const TOPIC_WORDS: Record<ComplianceTopic, RegExp> = {
  baa: /\b(hipaa|baa|baas|business associate)\b/i,
  dpa: /\b(dpa|data processing (agreement|addendum)|data protection (agreement|addendum)|gdpr)\b/i,
  eu_region:
    /\b(eu|e\.u\.|europe|european|eea|frankfurt|ireland|dublin|germany|paris|france|amsterdam|netherlands|stockholm|sweden|london|region|regions|residency)\b/i,
  soc2: /\bsoc\s?(2|ii)\b/i,
};

const ANY_TOPIC = new RegExp(
  [
    ...Object.values(TOPIC_WORDS).map((re) => re.source),
    "\\b(iso\\s?27001|subprocessors?|sub-processors?|data cent(er|re)s?|data location|where (your |is )?data)\\b",
  ].join("|"),
  "i",
);

const MAX_LINE = 400;
const MAX_LINES_PER_PAGE = 120;

/** The lines of a page that touch a compliance topic, in page order, without duplicates. */
export function complianceLines(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of htmlToLines(html)) {
    if (!ANY_TOPIC.test(line)) continue;
    const kept = line.length > MAX_LINE ? line.slice(0, MAX_LINE) : line;
    if (seen.has(kept)) continue;
    seen.add(kept);
    out.push(kept);
    if (out.length === MAX_LINES_PER_PAGE) break;
  }
  return out;
}

export function samePages(a: ComplianceSnapshot["pages"] | undefined, b: ComplianceSnapshot["pages"]): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b);
}

/** What the model answered for one topic. "unstated": the lines don't say. */
export interface TopicAnswer {
  answer: "yes" | "plan" | "no" | "unstated";
  /** One short sentence: which plan, which regions, what is excluded. */
  detail: string;
  /** Copied word for word from one line of the page. */
  quote: string;
  /** The page the quote is on. */
  source: string;
}

export type ComplianceProposal = Record<ComplianceTopic, TopicAnswer>;

export interface ComplianceDecision {
  /** What to publish for the tool. */
  compliance: ToolCompliance;
  /** Topics whose published fact changed, one line each. */
  changed: string[];
  /** Topics left as they were, with why, for a person. */
  held: string[];
}

const squash = (s: string) => s.toLowerCase().replace(/[\s ​]+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

/** A quote shorter than this could match almost anywhere. */
export const MIN_QUOTE = 12;

/** "yes" and "plan" both mean the vendor offers it; "no" means it says it doesn't. */
const offers = (a: ComplianceFact["answer"]) => a !== "no";

/**
 * Decides what to publish from a model's answers, given what is published now and
 * the pages' lines as read today.
 */
export function decideCompliance(
  current: ToolCompliance | undefined,
  proposal: ComplianceProposal,
  pages: ComplianceSnapshot["pages"],
  today: string,
): ComplianceDecision {
  const facts: ToolCompliance["facts"] = {};
  const changed: string[] = [];
  const held: string[] = [];

  for (const topic of TOPICS) {
    const was = current?.facts[topic];
    const now = proposal[topic];
    const label = TOPIC_LABELS[topic];
    const keep = (why: string) => {
      if (was) facts[topic] = was;
      held.push(`${label}: ${why}`);
    };

    if (!now || now.answer === "unstated") {
      // The pages no longer say it. Unknown is the safe direction, so the old fact goes.
      if (was) changed.push(`${label}: was "${was.answer}", no longer stated on the pages read.`);
      continue;
    }
    const page = pages.find((p) => p.url === now.source);
    const quote = squash(now.quote);
    if (!page) {
      keep(`the answer names ${now.source || "no page"}, which isn't one of the pages read.`);
      continue;
    }
    if (quote.length < MIN_QUOTE || !page.lines.some((l) => squash(l).includes(quote))) {
      keep(`the quoted sentence isn't on ${now.source}.`);
      continue;
    }
    if (!TOPIC_WORDS[topic].test(now.quote)) {
      keep(`the quoted sentence doesn't mention it ("${now.quote}").`);
      continue;
    }
    if (was && offers(was.answer) !== offers(now.answer)) {
      keep(`the published answer is "${was.answer}" and the page now reads as "${now.answer}" ("${now.quote}", ${now.source}).`);
      continue;
    }
    const fact: ComplianceFact = { answer: now.answer, detail: now.detail.trim(), quote: now.quote.trim(), source: now.source };
    facts[topic] = fact;
    if (!was) changed.push(`${label}: ${fact.answer}. ${fact.detail}`);
    else if (was.answer !== fact.answer || was.detail !== fact.detail) changed.push(`${label}: ${was.answer} → ${fact.answer}. ${fact.detail}`);
  }
  return { compliance: { facts, readOn: today }, changed, held };
}

/**
 * Categories whose tools hold or process the product's user data. A DNS host or a
 * build service doesn't, so compliance facts neither help nor hurt them.
 */
export const DATA_CATEGORIES: ReadonlySet<CategorySlug> = new Set<CategorySlug>([
  "hosting", "database", "auth", "email", "monitoring", "analytics", "storage", "llm", "vector", "realtime", "internal_tools", "kv",
  "jobs", "sms", "search",
]);

/** Points per answer. A stated "no" costs more than a stated "yes" earns; an unstated answer is 0. */
export const COMPLIANCE_POINTS: Partial<Record<Need, { topic: ComplianceTopic; yes: number; plan: number; no: number }[]>> = {
  health_data: [{ topic: "baa", yes: 1, plan: 0.5, no: -3 }],
  eu: [
    { topic: "eu_region", yes: 1, plan: 0.5, no: -2 },
    { topic: "dpa", yes: 0, plan: 0, no: -1 },
  ],
  regulated: [{ topic: "soc2", yes: 0.5, plan: 0.5, no: 0 }],
};

const sentence = (s: string) => (s && !/[.!?]$/.test(s) ? `${s}.` : s);

function describe(topic: ComplianceTopic, fact: ComplianceFact): string {
  const head =
    fact.answer === "yes" ? `${TOPIC_LABELS[topic]}: yes.`
    : fact.answer === "plan" ? `${TOPIC_LABELS[topic]}: only on some plans.`
    : `${TOPIC_LABELS[topic]}: no.`;
  return `${head} ${sentence(fact.detail)} (${fact.source})`.replace(/\s+/g, " ");
}

export interface ComplianceItem {
  topic: ComplianceTopic;
  answer: ComplianceFact["answer"] | "unstated";
  text: string;
}

export interface ComplianceView {
  /** Added to the tool's score for this product. */
  score: number;
  /** One item per topic the product's needs make relevant, stated or not. */
  items: ComplianceItem[];
  /** Text of the stated "no" answers: reasons not to send this data through the tool. */
  blockers: string[];
}

/**
 * What a tool's compliance facts mean for a product with these needs. Returns null
 * when none of the needs makes compliance relevant, or the tool holds no user data.
 */
export function complianceFor(tool: Pick<Tool, "category" | "compliance">, needs: Need[]): ComplianceView | null {
  if (!DATA_CATEGORIES.has(tool.category)) return null;
  let score = 0;
  const items: ComplianceItem[] = [];
  const seen = new Set<ComplianceTopic>();
  for (const need of needs) {
    for (const rule of COMPLIANCE_POINTS[need] ?? []) {
      if (seen.has(rule.topic)) continue;
      seen.add(rule.topic);
      const fact = tool.compliance?.facts[rule.topic];
      if (!fact) {
        items.push({ topic: rule.topic, answer: "unstated", text: `${TOPIC_LABELS[rule.topic]}: not stated on the vendor pages Cuely reads; ask the vendor before relying on it.` });
        continue;
      }
      score += rule[fact.answer];
      items.push({ topic: rule.topic, answer: fact.answer, text: describe(rule.topic, fact) });
    }
  }
  if (!items.length) return null;
  items.sort((x, y) => TOPICS.indexOf(x.topic) - TOPICS.indexOf(y.topic));
  return { score: Math.round(score * 10) / 10, items, blockers: items.filter((i) => i.answer === "no").map((i) => i.text) };
}

/** Every stated fact for a tool, one line each, for views that aren't about one product. */
export function statedCompliance(c: ToolCompliance | undefined): string[] {
  if (!c) return [];
  return TOPICS.flatMap((t) => (c.facts[t] ? [describe(t, c.facts[t]!)] : []));
}
