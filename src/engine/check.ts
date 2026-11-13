/**
 * check_project: a review of a stack that already exists.
 *
 * recommend_stack answers "what should I use?". This answers "is what I use still
 * right?" with today's prices, health signals and compliance facts. For every tool
 * the builder names, it says keep or switch; for every core part the product needs
 * and nothing covers, it says what to add.
 *
 * The rule is the same one recommend_stack applies to tools you already use, read
 * the other way round: a tool in use is kept unless another scores more than
 * SWITCH_COST higher for this product, or its vendor says it doesn't offer what the
 * product's data requires (a stated "no" on a BAA or an EU region).
 */
import type { CategorySlug, Need, Tool } from "@/catalog";
import { POLICY } from "@/catalog";
import { NEED_LABELS } from "./needs";
import type { Answers } from "./profile";
import {
  catchesFor,
  categoriesFor,
  METHOD_URL,
  productLabel,
  rankCategory,
  readProduct,
  resolveTool,
  routeRecipe,
  strongestReason,
  SWITCH_COST,
  toCard,
  type CatalogSnapshot,
  type StackRole,
  type ToolCard,
} from "./recommend";

export interface CheckInput {
  description: string;
  /** Tools the project uses now (names or slugs). */
  using: string[];
  needs?: Need[];
  answers?: Answers;
}

export type Verdict = "keep" | "switch" | "add";

export interface CheckItem {
  category: CategorySlug;
  categoryName: string;
  role: StackRole;
  verdict: Verdict;
  /** The tool in use, or null when the verdict is "add". */
  current: ToolCard | null;
  /** The tool to move to or add; null when the verdict is "keep". */
  suggestion: ToolCard | null;
  /** How much higher the best other tool scores for this product; 0 when the current one is the best. */
  gap: number;
  why: string;
  /** Things to keep an eye on for the current tool even if it stays. */
  watch: string[];
}

export interface ProjectCheck {
  status: "ok" | "outside_coverage" | "nothing_recognized";
  description: string;
  productLabel: string;
  detectedNeeds: { need: Need; label: string; matched: string }[];
  assumed: string[];
  headline: string;
  items: CheckItem[];
  /** Optional parts nothing covers yet, with what Cuely would pick. */
  optionalAdds: { category: CategorySlug; categoryName: string; tool: string; name: string; reason: string }[];
  catches: { text: string; source: string; verifiedOn: string }[];
  /** Names passed in `using` that aren't in the catalog, so they weren't checked. */
  notChecked: string[];
  nextStep: string;
  policy: string;
  method: string;
}

const round = (n: number) => Math.round(n * 10) / 10;
/** "Hosting" reads as "hosting" mid-sentence; "DNS" stays "DNS". */
export const midSentence = (name: string) => (/^.[^A-Z]*$/.test(name) ? name.toLowerCase() : name);

export function checkProject(catalog: CatalogSnapshot, input: CheckInput): ProjectCheck {
  const { profile, unknown, coverage, detected, needs, b2b } = readProduct(input.description, input.answers, input.needs);

  const inUse: Tool[] = [];
  const notChecked: string[] = [];
  for (const ref of input.using) {
    const t = resolveTool(catalog.tools, ref);
    if (!t) notChecked.push(ref.trim());
    else if (!inUse.includes(t)) inUse.push(t);
  }

  const base = {
    description: input.description,
    productLabel: productLabel(profile, b2b),
    detectedNeeds: detected.map((d) => ({ need: d.need, label: NEED_LABELS[d.need], matched: d.matched })),
    notChecked: notChecked.filter(Boolean),
    policy: POLICY,
    method: METHOD_URL,
  };
  const empty = { assumed: [], items: [], optionalAdds: [], catches: [] };

  if (coverage.status === "outside") {
    return {
      ...base,
      ...empty,
      status: "outside_coverage",
      headline: "Outside Cuely's coverage.",
      nextStep: `${coverage.notes.join(" ")} Tell the user Cuely doesn't cover this kind of product.`,
    };
  }
  if (!inUse.length) {
    return {
      ...base,
      ...empty,
      status: "nothing_recognized",
      headline: "None of the tools named are in Cuely's catalog.",
      nextStep: "Call list_categories to see the tools Cuely tracks, or recommend_stack for a stack from scratch.",
    };
  }

  // What the description left open is assumed, and said: a review shouldn't stop to ask.
  const assumed = unknown.map((u) =>
    u === "platform" ? "a website or web app, not a phone app" : u === "money" ? "no payments between users" : "for customers, not your own staff",
  );

  const { recipe } = routeRecipe(catalog.recipes, profile, input.description, b2b);
  const plan = categoriesFor(profile, needs).pick;
  // A tool in use is checked even when the product type wouldn't call for its category.
  for (const t of inUse) if (!plan.some((p) => p.slug === t.category)) plan.push({ slug: t.category, role: "optional" });

  const items: CheckItem[] = [];
  const optionalAdds: ProjectCheck["optionalAdds"] = [];

  for (const { slug, role } of plan) {
    const cat = catalog.categories.find((c) => c.slug === slug);
    if (!cat) continue;
    const recipeItem = recipe?.stack.find((s) => s.category === slug);
    // Ranked as for a fresh start: no switching bonus, so the gap is the real difference.
    const ranked = rankCategory(catalog.tools, slug, needs, { recipeTool: recipeItem?.tool });
    if (!ranked.length) continue;
    const finalRole: StackRole = recipeItem && role !== "if_you_build" ? (recipeItem.optional ? "optional" : "core") : role;
    const reasonFor = (t: Tool) => strongestReason(t, needs) ?? (t.slug === recipeItem?.tool ? recipeItem.why : t.pitch);
    const current = inUse.filter((t) => t.category === slug);

    if (!current.length) {
      const top = ranked[0].t;
      if (finalRole === "core") {
        items.push({
          category: slug,
          categoryName: cat.name,
          role: finalRole,
          verdict: "add",
          current: null,
          suggestion: toCard(top, reasonFor(top), needs),
          gap: 0,
          why: `Nothing you named covers ${midSentence(cat.name)}, and this kind of product needs it.`,
          watch: [],
        });
      } else if (finalRole === "optional") {
        optionalAdds.push({ category: slug, categoryName: cat.name, tool: top.slug, name: top.name, reason: reasonFor(top) });
      }
      continue;
    }

    for (const cur of current) {
      const mine = ranked.find((r) => r.t === cur)!;
      const card = toCard(cur, reasonFor(cur), needs);
      const blockers = card.compliance?.blockers ?? [];
      // The best other tool; when the current one is blocked, the best one that isn't.
      const others = ranked.filter((r) => r.t !== cur);
      const clean = others.filter((r) => !toCard(r.t, "", needs).compliance?.blockers.length);
      const best = (blockers.length ? clean[0] : others[0]) ?? null;
      const gap = best ? round(Math.max(0, best.s - mine.s)) : 0;

      const watch: string[] = [];
      if (cur.health && cur.health.score < 0) watch.push(`${cur.health.reasons[0]} (measured ${cur.health.measuredOn})`);
      for (const i of card.compliance?.items ?? []) if (i.answer === "plan" || i.answer === "unstated") watch.push(i.text);

      let verdict: Verdict = "keep";
      let why: string;
      if (blockers.length && best) {
        verdict = "switch";
        why = `${blockers[0]} ${best.t.name} doesn't say that, and fits: ${reasonFor(best.t)}`;
      } else if (blockers.length) {
        why = `${blockers[0]} No other ${midSentence(cat.name)} tool Cuely tracks is clear of this either, so keep the data it needs out of ${cur.name} or ask the vendor.`;
      } else if (!best || gap === 0) {
        why = "It's what Cuely would pick today for this product.";
      } else if (gap > SWITCH_COST) {
        verdict = "switch";
        why = `${best.t.name} scores ${gap} points higher for this product, more than the ${SWITCH_COST} points Cuely counts for the cost of switching. ${reasonFor(best.t)}`;
      } else {
        why = `${best.t.name} scores ${gap} points higher for this product, but that's under the ${SWITCH_COST} points Cuely counts for the cost of switching.`;
      }

      items.push({
        category: slug,
        categoryName: cat.name,
        role: finalRole,
        verdict,
        current: card,
        suggestion: verdict === "switch" && best ? toCard(best.t, reasonFor(best.t), needs) : null,
        gap,
        why,
        watch,
      });
    }
  }

  const order: Verdict[] = ["switch", "add", "keep"];
  items.sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict));

  const n = (v: Verdict) => items.filter((i) => i.verdict === v).length;
  const parts: string[] = [];
  if (n("switch")) parts.push(`${n("switch")} to change`);
  if (n("add")) parts.push(`${n("add")} to add`);
  parts.push(`${n("keep")} fine as ${n("keep") === 1 ? "it is" : "they are"}`);

  const catches = catchesFor(profile, needs).map((c) => ({ text: c.text, source: c.source, verifiedOn: c.verifiedOn }));

  return {
    ...base,
    status: "ok",
    assumed,
    headline: `${base.productLabel}: ${parts.join(", ")}.`,
    items,
    optionalAdds,
    catches,
    nextStep:
      n("switch") || n("add")
        ? "Tell the user each change and why, and let them decide; a switch costs real work. Call compare_tools for a side-by-side of any switch, and run check_project again after big changes to the product."
        : "Nothing needs to change. Run check_project again when the product changes (new region, payments, health data, AI) or every few weeks; prices, outages and vendor terms are re-read daily.",
  };
}
