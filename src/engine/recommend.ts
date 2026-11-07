import type { Category, CategorySlug, Need, Recipe, Tool } from "@/catalog";
import { POLICY } from "@/catalog";
import { ALL_NEEDS, detectNeeds, NEED_LABELS, type DetectedNeed } from "./needs";

/** Everything the engine needs; supplied by a repository (memory or Postgres). */
export interface CatalogSnapshot {
  categories: Category[];
  tools: Tool[];
  recipes: Recipe[];
}

export const METHOD_URL = "https://cuely.dev/#method";

const DEFAULT_OPTIONAL: CategorySlug[] = ["secrets", "analytics", "storage"];

export interface RecommendInput {
  description: string;
  categories?: CategorySlug[];
  alreadyUsing?: string[];
  avoid?: string[];
  needs?: Need[];
}

export interface ToolCard {
  slug: string;
  name: string;
  reason: string;
  freeTier: string | null;
  paidStartsAt: string | null;
  freeTierCommercialUse: boolean | null;
  watchOut: string | null;
  pricingUrl: string;
  verifiedOn: string;
}

export interface StackPick {
  category: CategorySlug;
  categoryName: string;
  optional: boolean;
  pick: ToolCard;
  alternatives: { slug: string; name: string; when: string }[];
  score: number;
}

export interface Recommendation {
  description: string;
  productType: { recipe: string | null; title: string | null };
  detectedNeeds: { need: Need; label: string; matched: string }[];
  stack: StackPick[];
  nextStep: string;
  policy: string;
  method: string;
}

/** Normalizes a tool reference ("Clerk", "clerk", "WorkOS") to a slug, or null. */
export function resolveTool(tools: Tool[], ref: string): Tool | null {
  const r = ref.trim().toLowerCase();
  if (!r) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    tools.find((t) => t.slug === r) ??
    tools.find((t) => t.name.toLowerCase() === r) ??
    tools.find((t) => norm(t.name) === norm(r) || norm(t.slug) === norm(r)) ??
    tools.find((t) => norm(t.name).startsWith(norm(r)) && norm(r).length >= 4) ??
    null
  );
}

export function matchRecipe(recipes: Recipe[], text: string): Recipe | null {
  const t = text.toLowerCase();
  let best: { recipe: Recipe; hits: number } | null = null;
  for (const recipe of recipes) {
    const hits = recipe.matches.filter((m) => new RegExp(`(^|[^a-z0-9])${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(t)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { recipe, hits };
  }
  return best?.recipe ?? null;
}

/**
 * Score = sum of the tool's published fit weights for each detected need,
 * plus a small editorial default (baseline) that only decides close calls.
 * Tools the builder already uses get a fixed switching-cost bonus.
 */
export function scoreTool(tool: Tool, needs: Need[], categorySize: number, alreadyUsing: boolean): number {
  const needScore = needs.reduce((sum, n) => sum + (tool.fit[n]?.weight ?? 0), 0);
  const baseline = (categorySize - tool.baseline + 1) * 0.4;
  return needScore + baseline + (alreadyUsing ? 4 : 0);
}

function strongestReason(tool: Tool, needs: Need[]): string | null {
  let best: { w: number; reason: string } | null = null;
  for (const n of needs) {
    const f = tool.fit[n];
    if (f && f.weight > 0 && (!best || f.weight > best.w)) best = { w: f.weight, reason: f.reason };
  }
  return best?.reason ?? null;
}

function alternativeWhen(tool: Tool): string {
  let best: { w: number; need: Need; reason: string } | null = null;
  for (const n of ALL_NEEDS) {
    const f = tool.fit[n];
    if (f && f.weight > 0 && (!best || f.weight > best.w)) best = { w: f.weight, need: n, reason: f.reason };
  }
  return best ? `If ${NEED_LABELS[best.need]} matters most: ${best.reason}` : tool.pitch;
}

export function toCard(tool: Tool, reason: string): ToolCard {
  return {
    slug: tool.slug,
    name: tool.name,
    reason,
    freeTier: tool.freeTier,
    paidStartsAt: tool.paidStartsAt,
    freeTierCommercialUse: tool.freeTierCommercialUse,
    watchOut: tool.watchOut[0] ?? null,
    pricingUrl: tool.pricingUrl,
    verifiedOn: tool.verifiedOn,
  };
}

export function recommendStack(catalog: CatalogSnapshot, input: RecommendInput): Recommendation {
  const detected: DetectedNeed[] = detectNeeds(input.description);
  for (const n of input.needs ?? []) {
    if (!detected.some((d) => d.need === n)) detected.push({ need: n, matched: "(requested)" });
  }
  const needs = detected.map((d) => d.need);
  const recipe = matchRecipe(catalog.recipes, input.description);

  const using = new Set(
    (input.alreadyUsing ?? []).map((r) => resolveTool(catalog.tools, r)?.slug).filter((s): s is string => !!s),
  );
  const avoid = new Set(
    (input.avoid ?? []).map((r) => resolveTool(catalog.tools, r)?.slug).filter((s): s is string => !!s),
  );

  const wanted = input.categories?.length
    ? catalog.categories.filter((c) => input.categories!.includes(c.slug))
    : catalog.categories;

  const stack: StackPick[] = [];
  for (const cat of [...wanted].sort((a, b) => a.order - b.order)) {
    const inCat = catalog.tools.filter((t) => t.category === cat.slug);
    const candidates = inCat.filter((t) => !avoid.has(t.slug));
    if (!candidates.length) continue;

    const ranked = candidates
      .map((t) => ({ t, s: scoreTool(t, needs, inCat.length, using.has(t.slug)) }))
      .sort((a, b) => b.s - a.s || a.t.baseline - b.t.baseline);

    const top = ranked[0];
    let reason: string;
    if (using.has(top.t.slug)) {
      reason = `You already use ${top.t.name}; nothing you described is worth the cost of switching.`;
    } else {
      reason = strongestReason(top.t, needs) ?? top.t.pitch;
    }

    const recipeItem = recipe?.stack.find((s) => s.category === cat.slug);
    const optional = recipeItem ? !!recipeItem.optional : DEFAULT_OPTIONAL.includes(cat.slug);

    stack.push({
      category: cat.slug,
      categoryName: cat.name,
      optional,
      pick: toCard(top.t, reason),
      alternatives: ranked.slice(1, 3).map(({ t }) => ({ slug: t.slug, name: t.name, when: alternativeWhen(t) })),
      score: Math.round(top.s * 10) / 10,
    });
  }

  const nextStep = recipe
    ? `Call get_recipe with product_type "${recipe.slug}" for the full setup steps, schema and pitfalls.`
    : `No full recipe matches this product type yet; available: ${catalog.recipes.map((r) => r.slug).join(", ")}. The stack above comes from the general rules.`;

  return {
    description: input.description,
    productType: { recipe: recipe?.slug ?? null, title: recipe?.title ?? null },
    detectedNeeds: detected.map((d) => ({ need: d.need, label: NEED_LABELS[d.need], matched: d.matched })),
    stack,
    nextStep,
    policy: POLICY,
    method: METHOD_URL,
  };
}
