import type { Category, Recipe, Tool } from "@/catalog";
import type { CompareResult } from "@/engine/compare";
import type { Recommendation } from "@/engine/recommend";

const free = (t: { freeTier: string | null }) => t.freeTier ?? "No free plan.";

export function renderRecommendation(r: Recommendation): string {
  const lines: string[] = [];
  lines.push(`# Recommended stack`);
  if (r.productType.title) lines.push(`Product type: ${r.productType.title} (recipe: \`${r.productType.recipe}\`)`);
  if (r.detectedNeeds.length) lines.push(`Detected needs: ${r.detectedNeeds.map((d) => d.label).join("; ")}`);
  lines.push("");
  for (const s of r.stack) {
    lines.push(`## ${s.categoryName}${s.optional ? " (optional)" : ""}: ${s.pick.name}`);
    lines.push(`- Why: ${s.pick.reason}`);
    lines.push(`- Free plan: ${free(s.pick)}`);
    if (s.pick.paidStartsAt) lines.push(`- Paid from: ${s.pick.paidStartsAt}`);
    if (s.pick.watchOut) lines.push(`- Watch out: ${s.pick.watchOut}`);
    for (const a of s.alternatives) lines.push(`- Alternative, ${a.name}: ${a.when}`);
    lines.push(`- Facts read ${s.pick.verifiedOn} from ${s.pick.pricingUrl}`);
    lines.push("");
  }
  lines.push(`Next: ${r.nextStep}`);
  lines.push(`Policy: ${r.policy} Method: ${r.method}`);
  return lines.join("\n");
}

export function renderRecipe(r: Recipe, tools: Tool[], includeSteps = true): string {
  const name = (slug: string) => tools.find((t) => t.slug === slug)?.name ?? slug;
  const L: string[] = [`# Recipe: ${r.title}`, r.summary, ""];
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

export function renderCompare(c: CompareResult): string {
  if (!c.ok) return `Error: ${c.error}${c.suggestions ? `\nKnown tools: ${c.suggestions.join(", ")}` : ""}`;
  const [a, b] = c.tools;
  const L = [`# ${a.name} vs ${b.name} (${c.category})`, c.verdict, ""];
  for (const t of c.tools) {
    L.push(`## ${t.name}`, t.summary, `- Best for: ${t.bestFor.join("; ")}`, `- Watch out: ${t.watchOut.join(" ")}`);
    L.push(`- Free plan: ${free(t)}`, `- Paid from: ${t.paidStartsAt ?? "not stated on the pricing page"}`);
    L.push(`- Open source: ${t.openSource ? "yes" : "no"}; self-hostable: ${t.selfHostable ? "yes" : "no"}`);
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
    L.push(`- Watch out: ${t.watchOut.join(" ")}`, `- Facts read ${t.verifiedOn} from ${t.pricingUrl}`, "");
  }
  return L.join("\n");
}
