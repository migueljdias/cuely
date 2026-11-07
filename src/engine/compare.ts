import type { Need, Tool } from "@/catalog";
import { POLICY } from "@/catalog";
import { detectNeeds, NEED_LABELS, NEED_SHORT } from "./needs";
import { detectProfile } from "./profile";
import { METHOD_URL, resolveTool, scoreTool, type CatalogSnapshot } from "./recommend";

export interface CompareInput {
  a: string;
  b: string;
  context?: string;
}

export type CompareResult =
  | {
      ok: true;
      category: string;
      tools: ReturnType<typeof side>[];
      differences: { need: Need; label: string; a: { weight: number; reason: string }; b: { weight: number; reason: string } }[];
      verdict: string;
      betterOption: { slug: string; name: string; reason: string } | null;
      detectedNeeds: Need[];
      policy: string;
      method: string;
    }
  | { ok: false; error: string; suggestions?: string[] };

function side(t: Tool) {
  return {
    slug: t.slug,
    name: t.name,
    summary: t.summary,
    bestFor: t.bestFor,
    watchOut: t.watchOut,
    freeTier: t.freeTier,
    paidStartsAt: t.paidStartsAt,
    freeTierCommercialUse: t.freeTierCommercialUse,
    openSource: t.openSource,
    selfHostable: t.selfHostable,
    pricingUrl: t.pricingUrl,
    verifiedOn: t.verifiedOn,
  };
}

export function compareTools(catalog: CatalogSnapshot, input: CompareInput): CompareResult {
  const a = resolveTool(catalog.tools, input.a);
  const b = resolveTool(catalog.tools, input.b);
  const missing = [!a && input.a, !b && input.b].filter(Boolean) as string[];
  if (missing.length) {
    return {
      ok: false,
      error: `Not in the catalog: ${missing.join(", ")}.`,
      suggestions: catalog.tools.map((t) => t.slug),
    };
  }
  if (a!.slug === b!.slug) return { ok: false, error: "Those are the same tool." };
  if (a!.category !== b!.category) {
    return {
      ok: false,
      error: `${a!.name} is ${a!.category} and ${b!.name} is ${b!.category}; compare_tools compares two options in one category.`,
    };
  }

  const needs: Need[] = input.context ? detectNeeds(input.context).map((d) => d.need) : [];
  if (input.context) {
    const { profile } = detectProfile(input.context);
    const add = (n: Need) => !needs.includes(n) && needs.push(n);
    if (profile.platform === "mobile" || profile.platform === "both") add("mobile");
    if (profile.money === "users_pay_each_other") add("marketplace");
    if (profile.audience === "internal") add("internal");
  }
  const size = catalog.tools.filter((t) => t.category === a!.category).length;
  const sa = scoreTool(a!, needs, size, false);
  const sb = scoreTool(b!, needs, size, false);

  const allNeeds = new Set<Need>([...Object.keys(a!.fit), ...Object.keys(b!.fit)] as Need[]);
  const differences = [...allNeeds]
    .map((n) => ({
      need: n,
      label: NEED_LABELS[n],
      a: { weight: a!.fit[n]?.weight ?? 0, reason: a!.fit[n]?.reason ?? "No particular strength here." },
      b: { weight: b!.fit[n]?.weight ?? 0, reason: b!.fit[n]?.reason ?? "No particular strength here." },
    }))
    .filter((d) => d.a.weight !== d.b.weight)
    .sort((x, y) => Math.abs(y.a.weight - y.b.weight) - Math.abs(x.a.weight - x.b.weight));

  const winner = sa === sb ? (a!.baseline <= b!.baseline ? a! : b!) : sa > sb ? a! : b!;
  const loser = winner === a ? b! : a!;
  const verdict = needs.length
    ? `For what you described (${needs.map((n) => NEED_LABELS[n]).join("; ")}), ${winner.name} fits better. ${(() => {
        const edge = differences.find((d) => (loser === a ? d.a.weight > d.b.weight : d.b.weight > d.a.weight));
        return edge ? `Pick ${loser.name} instead if you care most about ${NEED_SHORT[edge.need]}.` : `${loser.name} has no edge for this case.`;
      })()}`
    : `With no context, ${winner.name} is the default pick: ${winner.pitch} Pass context to get a verdict for your case.`;

  // When a third tool in the category fits the context better than either, say so.
  let betterOption: { slug: string; name: string; reason: string } | null = null;
  if (needs.length) {
    const best = catalog.tools
      .filter((t) => t.category === a!.category)
      .map((t) => ({ t, s: scoreTool(t, needs, size, false) }))
      .sort((x, y) => y.s - x.s || x.t.baseline - y.t.baseline)[0];
    if (best && best.t.slug !== a!.slug && best.t.slug !== b!.slug && best.s > Math.max(sa, sb) + 1) {
      const top = needs.map((n) => best.t.fit[n]).filter((f) => f && f.weight > 0).sort((x, y) => y!.weight - x!.weight)[0];
      betterOption = { slug: best.t.slug, name: best.t.name, reason: top?.reason ?? best.t.pitch };
    }
  }
  const fullVerdict = betterOption ? `${verdict} But for this case Cuely would pick neither: ${betterOption.name}. ${betterOption.reason}` : verdict;

  return {
    ok: true,
    category: a!.category,
    tools: [side(a!), side(b!)],
    differences,
    verdict: fullVerdict,
    betterOption,
    detectedNeeds: needs,
    policy: POLICY,
    method: METHOD_URL,
  };
}
