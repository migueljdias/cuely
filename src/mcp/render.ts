import type { Category, ComplianceTopic, Recipe, Tool } from "@/catalog";
import { COST_PROFILE } from "@/catalog";
import type { CompareResult } from "@/engine/compare";
import { midSentence, type ProjectCheck } from "@/engine/check";
import type { ChecklistItem, ProjectStart } from "@/engine/start";
import type { Recommendation } from "@/engine/recommend";
import { TOPIC_LABELS, statedCompliance } from "@/freshness/compliance";

const free = (t: { freeTier: string | null }) => t.freeTier ?? "No free plan.";

/**
 * What the picks' vendors say on the compliance topics this product needs: stated
 * answers one per line, then who doesn't say, per topic.
 */
function complianceSection(r: Recommendation): string[] {
  const picks = r.stack.filter((x) => x.pick.compliance);
  if (!picks.length) return [];
  const L = ["## Compliance (each vendor's own words; check before you sign, this is not legal advice)"];
  const silent = new Map<string, string[]>();
  for (const x of picks) {
    for (const i of x.pick.compliance!.items) {
      if (i.answer === "unstated") silent.set(i.topic, [...(silent.get(i.topic) ?? []), x.pick.name]);
      else L.push(`- ${x.pick.name}: ${i.text}`);
    }
  }
  for (const [topic, names] of silent) L.push(`- ${TOPIC_LABELS[topic as ComplianceTopic]} not stated on the pages Cuely reads for: ${names.join(", ")}. Ask each before relying on it.`);
  L.push("");
  return L;
}

export function renderRecommendation(r: Recommendation, detail: "summary" | "full" = "summary", footer = true): string {
  const L: string[] = [];
  if (r.status === "outside_coverage") {
    L.push(`# Outside Cuely's coverage`);
    for (const n of r.coverage.notes) L.push(`- ${n}`);
    L.push("", `Next: ${r.nextStep}`);
    return L.join("\n");
  }
  if (r.status === "needs_answers") {
    L.push(`# A few questions first`, "The answers change which tools fit, so ask before recommending:");
    r.questions.forEach((q, i) => {
      const opts = q.options?.length ? ` (${q.options.map((o) => `${o.value}: ${o.label}`).join("; ")})` : "";
      L.push(`${i + 1}. ${q.question}${opts}`, `   Why it matters: ${q.why}`);
    });
    if (r.coverage.status === "partial") for (const n of r.coverage.notes) L.push(`- Coverage: ${n}`);
    L.push("", `Next: ${r.nextStep}`);
    return L.join("\n");
  }
  const s = r.summary!;
  L.push(`# ${s.headline}`);
  if (r.profile.assumed.length) L.push(`Assumed: ${r.profile.assumed.join("; ")}. Ask the user if any is wrong.`);
  if (r.coverage.status === "partial") for (const n of r.coverage.notes) L.push(`Coverage: ${n}`);
  if (r.recipeNote) L.push(r.recipeNote);
  L.push("");
  if (s.cost) L.push(`## Cost`, s.cost.text, `Usage profile: ${s.cost.profile}`, "");
  if (s.catches.length) {
    L.push(`## Catches that matter`);
    for (const c of s.catches) L.push(`- ${c.text} (read ${c.verifiedOn}, ${c.source})`);
    L.push("");
  }
  L.push(`## Stack`);
  const roleTag = (x: (typeof r.stack)[number]) =>
    x.role === "optional" ? " (optional)" : x.role === "if_you_build" ? " (only if you build it yourself)" : "";
  if (detail === "full") {
    L.push("");
    for (const x of r.stack) {
      L.push(`### ${x.categoryName}${roleTag(x)}: ${x.pick.name}`);
      L.push(`- Why: ${x.pick.reason}`);
      if (x.pick.monthlyCost !== null) L.push(`- At the usage profile: $${x.pick.monthlyCost}/month. ${x.pick.costBasis ?? ""}`.trimEnd());
      L.push(`- Free plan: ${free(x.pick)}`);
      if (x.pick.paidStartsAt) L.push(`- Paid from: ${x.pick.paidStartsAt}`);
      if (x.pick.watchOut) L.push(`- Watch out: ${x.pick.watchOut}`);
      if (x.pick.health) L.push(`- Measured ${x.pick.health.measuredOn} (${x.pick.health.score > 0 ? "+" : ""}${x.pick.health.score} to its score): ${x.pick.health.reasons.join(" ")}`);
      for (const i of x.pick.compliance?.items ?? []) L.push(`- ${i.text}`);
      for (const a of x.alternatives) L.push(`- Alternative, ${a.name}: ${a.when}`);
      L.push(`- Facts read ${x.pick.verifiedOn} from ${x.pick.pricingUrl}`, "");
    }
    if (s.moreCatches.length) {
      L.push(`## More catches`);
      for (const c of s.moreCatches) L.push(`- ${c.text} (read ${c.verifiedOn}, ${c.source})`);
      L.push("");
    }
  } else {
    for (const x of r.stack) {
      const alt = x.alternatives[0] ? ` Or ${x.alternatives[0].name}.` : "";
      L.push(`- ${x.categoryName}${roleTag(x)}: ${x.pick.name}. ${x.pick.reason}${alt}`);
    }
    L.push("");
    L.push(...complianceSection(r));
  }
  if (r.leftOut.length) {
    const byReason = new Map<string, string[]>();
    for (const l of r.leftOut) byReason.set(l.reason, [...(byReason.get(l.reason) ?? []), l.category]);
    L.push(`Left out: ${[...byReason].map(([why, cats]) => `${cats.join(", ")} (${why})`).join(" ")}`);
  }
  if (footer) {
    L.push(`Next: ${r.nextStep}`);
    L.push(`Policy: ${r.policy} Method: ${r.method}`);
  }
  return L.join("\n");
}

const PHASE_TITLES: Record<ChecklistItem["phase"], string> = {
  day_one: "Set up before real data goes in",
  before_launch: "Finish before launch",
};

/** The stack, then the security and compliance to-do list as checkboxes. */
export function renderStart(s: ProjectStart): string {
  if (s.status !== "ok") return renderRecommendation(s.recommendation);
  const r = s.recommendation;
  const L = [renderRecommendation(r, "summary", false), "", "## Security and compliance checklist (points to obligations; not legal advice)"];
  for (const phase of ["day_one", "before_launch"] as const) {
    const items = s.checklist.filter((i) => i.phase === phase);
    if (!items.length) continue;
    L.push(`### ${PHASE_TITLES[phase]}`);
    for (const i of items) L.push(`- [ ] **${i.title}.** ${i.detail} Why: ${i.why} (${i.source})`);
    L.push("");
  }
  L.push(`Next: ${s.nextStep}`, `Policy: ${r.policy} Method: ${r.method}`);
  return L.join("\n");
}

/**
 * The monthly tool bill for a recipe's core stack at Cuely's published profile,
 * summed from the catalog's cost facts, so it always matches recommend_stack.
 */
export function recipeCost(r: Recipe, tools: Tool[]): string | null {
  const items = r.stack
    .filter((s) => !s.optional)
    .map((s) => tools.find((t) => t.slug === s.tool))
    .filter((t): t is Tool => !!t?.cost && t.cost.monthly !== null)
    .map((t) => (r.costOverrides?.[t.slug] ? { ...t, cost: { ...t.cost!, monthly: r.costOverrides[t.slug].monthly } } : t));
  if (!items.length) return null;
  const staff = items.some((t) => t.cost!.scale === "10_staff");
  const total = items.reduce((a, t) => a + t.cost!.monthly!, 0);
  const fmt = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  const paid = items.filter((t) => t.cost!.monthly! > 0).sort((a, b) => b.cost!.monthly! - a.cost!.monthly!);
  const free = items.filter((t) => t.cost!.monthly === 0);
  let text = `About ${fmt(total)}/month ${staff ? `for ${COST_PROFILE.internalStaff} staff` : `at ${COST_PROFILE.users.toLocaleString("en-US")} users`} in tool bills`;
  if (paid.length) text += `: ${paid.map((t) => `${t.name} ${fmt(t.cost!.monthly!)}`).join(" + ")}`;
  if (free.length) text += `${paid.length ? "; " : ": "}$0 for ${free.map((t) => t.name).join(", ")}`;
  const why = Object.entries(r.costOverrides ?? {}).filter(([slug]) => items.some((t) => t.slug === slug)).map(([, o]) => o.basis);
  return `${text}.${why.length ? ` ${why.join(" ")}` : ""}`;
}

export function renderRecipe(r: Recipe, tools: Tool[], includeSteps = true): string {
  const name = (slug: string) => tools.find((t) => t.slug === slug)?.name ?? slug;
  const L: string[] = [`# Recipe: ${r.title}`, r.summary, ""];
  const cost = recipeCost(r, tools);
  if (cost || r.costNotes?.length) {
    L.push("## Cost");
    if (cost) L.push(cost);
    for (const n of r.costNotes ?? []) L.push(`- ${n}`);
    L.push(`Usage profile: ${COST_PROFILE.text}`, "");
  }
  if (r.catches?.length) {
    L.push("## Catches that matter", ...r.catches.map((c) => `- ${c.text} (read ${c.verifiedOn}, ${c.source})`), "");
  }
  L.push("## Fits when", ...r.fitsWhen.map((x) => `- ${x}`), "");
  L.push("## Not for", ...r.notFor.map((x) => `- ${x}`), "");
  L.push("## Stack");
  for (const s of r.stack) {
    L.push(`- ${s.category}${s.optional ? " (optional)" : ""}: **${name(s.tool)}**. ${s.why}`);
    for (const a of s.alternatives) L.push(`  - Or ${name(a.tool)}: ${a.when}`);
  }
  L.push("");
  if (includeSteps) {
    L.push("## Steps");
    r.steps.forEach((s, i) => {
      L.push(`### ${i + 1}. ${s.title}`, s.detail, ...s.actions.map((a) => `- ${a}`));
      if (s.commands?.length) L.push("```sh", ...s.commands, "```");
      for (const f of s.files ?? []) {
        const lang = f.path.endsWith(".sql") ? "sql" : "ts";
        L.push(`File \`${f.path}\`:`, "```" + lang, f.contents.trimEnd(), "```");
      }
      L.push(`Done when: ${s.check}`);
      if (s.docs?.length) L.push(`Docs: ${s.docs.join(" , ")}`);
      L.push("");
    });
  }
  L.push("## Best practices", ...r.bestPractices.map((x) => `- ${x}`), "");
  L.push("## Pitfalls", ...r.pitfalls.map((x) => `- ${x}`), "");
  L.push("## Compliance notes (obligations to check, not guarantees)", ...r.complianceNotes.map((x) => `- ${x}`), "");
  L.push(`Verified ${r.verifiedOn}. Prices and limits: call compare_tools or list_categories for each tool's source page.`);
  return L.join("\n");
}

export function renderCheck(c: ProjectCheck): string {
  const L = [`# ${c.headline}`];
  if (c.status !== "ok") {
    if (c.notChecked.length) L.push(`Not in the catalog: ${c.notChecked.join(", ")}.`);
    L.push("", `Next: ${c.nextStep}`);
    return L.join("\n");
  }
  if (c.assumed.length) L.push(`Assumed: ${c.assumed.join("; ")}. Ask the user if any is wrong.`);
  L.push("");
  const section = (title: string, verdict: ProjectCheck["items"][number]["verdict"]) => {
    const items = c.items.filter((i) => i.verdict === verdict);
    if (!items.length) return;
    L.push(`## ${title}`);
    for (const i of items) {
      const head =
        verdict === "switch" ? `${i.categoryName}: ${i.current!.name} → ${i.suggestion!.name}`
        : verdict === "add" ? `${i.categoryName}: add ${i.suggestion!.name}`
        : `${i.categoryName}: ${i.current!.name}`;
      L.push(`- ${head}. ${i.why}${verdict === "add" ? ` ${i.suggestion!.reason}` : ""}`);
      for (const w of i.watch) L.push(`  - Watch: ${w}`);
    }
    L.push("");
  };
  section("Change", "switch");
  section("Add", "add");
  section("Keep", "keep");
  if (c.catches.length) {
    L.push("## Catches for this kind of product");
    for (const x of c.catches) L.push(`- ${x.text} (read ${x.verifiedOn}, ${x.source})`);
    L.push("");
  }
  if (c.optionalAdds.length) L.push(`Optional, not covered yet: ${c.optionalAdds.map((o) => `${midSentence(o.categoryName)} (${o.name})`).join(", ")}.`);
  if (c.notChecked.length) L.push(`Not checked, because Cuely doesn't track them: ${c.notChecked.join(", ")}.`);
  L.push(`Next: ${c.nextStep}`);
  L.push(`Policy: ${c.policy} Method: ${c.method}`);
  return L.join("\n");
}

export function renderCompare(c: CompareResult): string {
  if (!c.ok) return `Error: ${c.error}${c.suggestions ? `\nKnown tools: ${c.suggestions.join(", ")}` : ""}`;
  const [a, b] = c.tools;
  const L = [`# ${a.name} vs ${b.name} (${c.category})`, c.verdict, ""];
  for (const t of c.tools) {
    L.push(`## ${t.name}`, t.summary, `- Best for: ${t.bestFor.join("; ")}`, `- Watch out: ${t.watchOut.join(" ")}`);
    L.push(`- Free plan: ${free(t)}`, `- Paid from: ${t.paidStartsAt ?? "not stated on the pricing page"}`);
    L.push(`- Open source: ${t.openSource ? "yes" : "no"}; self-hostable: ${t.selfHostable ? "yes" : "no"}`);
    for (const line of t.compliance) L.push(`- ${line}`);
    L.push(`- Facts read ${t.verifiedOn} from ${t.pricingUrl}`, "");
  }
  if (c.differences.length) {
    L.push("## Where they differ");
    for (const d of c.differences) L.push(`- ${d.label}: ${a.name} ${d.a.weight >= 0 ? "+" : ""}${d.a.weight} (${d.a.reason}) vs ${b.name} ${d.b.weight >= 0 ? "+" : ""}${d.b.weight} (${d.b.reason})`);
    L.push("");
  }
  L.push(`Policy: ${c.policy} Method: ${c.method}`);
  return L.join("\n");
}

export function renderCategories(cats: Category[], tools: Tool[]): string {
  const L = ["# Categories"];
  for (const c of cats) {
    const inCat = tools.filter((t) => t.category === c.slug).sort((x, y) => x.baseline - y.baseline);
    L.push(`- **${c.slug}** (${c.name}): ${c.description} Tools: ${inCat.map((t) => t.slug).join(", ")}.`);
  }
  L.push("", "Call list_categories with a category to see each tool's facts.");
  return L.join("\n");
}

export function renderCategory(c: Category, tools: Tool[]): string {
  const inCat = tools.filter((t) => t.category === c.slug).sort((x, y) => x.baseline - y.baseline);
  const L = [`# ${c.name}`, c.description, `How to choose: ${c.howToChoose}`, ""];
  for (const t of inCat) {
    L.push(`## ${t.name} (\`${t.slug}\`)${t.baseline === 1 ? ", the default pick" : ""}`, t.summary);
    L.push(`- Best for: ${t.bestFor.join("; ")}`, `- Free plan: ${free(t)}`, `- Paid from: ${t.paidStartsAt ?? "not stated"}`);
    L.push(`- Watch out: ${t.watchOut.join(" ")}`);
    for (const line of statedCompliance(t.compliance)) L.push(`- ${line}`);
    L.push(`- Facts read ${t.verifiedOn} from ${t.pricingUrl}`, "");
  }
  return L.join("\n");
}
