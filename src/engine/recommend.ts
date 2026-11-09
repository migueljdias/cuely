import type { Category, CategorySlug, Need, Recipe, Tool } from "@/catalog";
import { CATCHES, COST_PROFILE, POLICY } from "@/catalog";
import { ALL_NEEDS, detectNeeds, NEED_LABELS, NEED_SHORT, type DetectedNeed } from "./needs";
import {
  detectCoverage,
  detectProfile,
  QUESTIONS,
  type Answers,
  type Coverage,
  type Profile,
  type Question,
} from "./profile";

/** Everything the engine needs; supplied by a repository (memory or Postgres). */
export interface CatalogSnapshot {
  categories: Category[];
  tools: Tool[];
  recipes: Recipe[];
}

export const METHOD_URL = "https://cuely.dev/#method";

/** Read 2026-11-07 from developer.apple.com/programs and Google Play Console help (answer 6112435). */
const STORE_ACCOUNTS = "Apple Developer Program $99 a year, Google Play $25 once";

export interface RecommendInput {
  description: string;
  categories?: CategorySlug[];
  alreadyUsing?: string[];
  avoid?: string[];
  needs?: Need[];
  /** Answers to questions from an earlier call. */
  answers?: Answers;
  /** Skip questions and assume the most common case (the answer says what it assumed). */
  assumeDefaults?: boolean;
  /** "summary" (default) keeps the answer short; "full" adds every card's facts and alternatives. */
  detail?: "summary" | "full";
}

export interface ToolCard {
  slug: string;
  name: string;
  reason: string;
  freeTier: string | null;
  paidStartsAt: string | null;
  freeTierCommercialUse: boolean | null;
  watchOut: string | null;
  monthlyCost: number | null;
  costBasis: string | null;
  pricingUrl: string;
  verifiedOn: string;
}

export type StackRole = "core" | "optional" | "if_you_build";

export interface StackPick {
  category: CategorySlug;
  categoryName: string;
  role: StackRole;
  /** Kept for older clients: true when role is not "core". */
  optional: boolean;
  pick: ToolCard;
  alternatives: { slug: string; name: string; when: string }[];
  score: number;
}

export interface CostLine {
  /** Sum of the core picks' monthly cost at the profile. */
  monthly: number;
  scale: "1k_users" | "10_staff";
  items: { tool: string; name: string; monthly: number; basis: string }[];
  /** Fees that scale with revenue, quoted from the payment pick. */
  variable: string[];
  profile: string;
  text: string;
}

export interface Summary {
  headline: string;
  picks: { category: CategorySlug; categoryName: string; tool: string; name: string; reason: string }[];
  catches: { text: string; source: string; verifiedOn: string }[];
  moreCatches: { text: string; source: string; verifiedOn: string }[];
  cost: CostLine | null;
}

export interface Recommendation {
  status: "ok" | "needs_answers" | "outside_coverage";
  description: string;
  productType: { recipe: string | null; title: string | null; label: string };
  profile: {
    platform: Profile["platform"];
    money: Profile["money"];
    audience: Profile["audience"];
    ai: boolean;
    realtime: boolean;
    assumed: string[];
  };
  coverage: Coverage;
  questions: Question[];
  summary: Summary | null;
  detectedNeeds: { need: Need; label: string; matched: string }[];
  stack: StackPick[];
  leftOut: { category: CategorySlug; reason: string }[];
  recipeNote: string | null;
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
/**
 * A recipe is a tested combination for one product type. When a product matches a
 * recipe, the recipe's pick in a category gets this bonus, so recommend_stack and
 * get_recipe agree. It's small: a need you described that favors another tool by more
 * than a point still wins, and so does a tool you already use (+4).
 */
export const RECIPE_BONUS = 1;

/** Which recipe a product profile routes to, before any keyword match. */
export const RECIPE_FOR = {
  internal: "internal-tool",
  marketplace: "marketplace",
  mobile: "mobile-subscription-app",
  ai: "ai-docs-app",
  game: "daily-web-game",
} as const;

/**
 * Picks the recipe for a product: staff tools, then marketplaces, then phone apps,
 * then web games, then AI apps, from the profile; otherwise the best keyword match among the rest.
 * Returns a note when the recipe covers only part of the product.
 */
export function routeRecipe(recipes: Recipe[], profile: Profile, description: string, b2b: boolean): { recipe: Recipe | null; note: string | null } {
  const by = (slug: string) => recipes.find((r) => r.slug === slug) ?? null;
  const notes: string[] = [];
  let recipe: Recipe | null = null;
  if (profile.audience === "internal") {
    recipe = by(RECIPE_FOR.internal);
  } else if (profile.money === "users_pay_each_other") {
    recipe = by(RECIPE_FOR.marketplace);
    if (isMobile(profile)) notes.push("It's also a phone app: payments for real-world services stay outside in-app purchase, and the mobile-subscription-app recipe's build, sign-in and store steps still apply.");
  } else if (isMobile(profile)) {
    recipe = by(RECIPE_FOR.mobile);
    if (profile.money === "none") notes.push("Nothing here is paid, so skip the recipe's purchase, paywall and webhook steps.");
    if (profile.ai) notes.push("The AI parts aren't in this recipe: call the model API from a backend function, never from the app, and see the ai-docs-app recipe for retrieval and usage caps.");
  } else if (profile.game) {
    recipe = by(RECIPE_FOR.game);
    if (profile.money !== "none") notes.push("The recipe has no payment steps; for paid extras on the web, see the b2b-saas recipe's Stripe steps.");
    if (profile.ai) notes.push("The AI parts aren't in this recipe: call the model API from your server, cap calls per player, and see the ai-docs-app recipe.");
  } else if (profile.ai && (profile.rag || !b2b)) {
    recipe = by(RECIPE_FOR.ai);
    if (b2b) notes.push("Its first step points to the b2b-saas recipe for organizations, roles and invites.");
    if (!profile.rag) notes.push("Skip the recipe's document steps (parsing, embeddings, retrieval) if the product doesn't answer from documents.");
  }
  if (!recipe) {
    const routed = new Set<string>(Object.values(RECIPE_FOR));
    recipe = matchRecipe(recipes.filter((r) => !routed.has(r.slug)), description);
    if (recipe && profile.ai) notes.push(`The ${recipe.slug} recipe covers the SaaS parts (organizations, billing, email) but not the AI parts; the AI picks are in this answer, and the ai-docs-app recipe has the steps.`);
  }
  return { recipe, note: notes.length ? notes.join(" ") : null };
}

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
  return best ? `Choose it for ${NEED_SHORT[best.need]}: ${best.reason}` : tool.pitch;
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
    monthlyCost: tool.cost?.monthly ?? null,
    costBasis: tool.cost?.basis ?? null,
    pricingUrl: tool.pricingUrl,
    verifiedOn: tool.verifiedOn,
  };
}

const isMobile = (p: Profile) => p.platform === "mobile" || p.platform === "both";

/** Which categories this kind of product needs, and why the others are left out. */
export function categoriesFor(p: Profile, needs: Need[] = []): { pick: { slug: CategorySlug; role: StackRole }[]; leftOut: { category: CategorySlug; reason: string }[] } {
  const pick: { slug: CategorySlug; role: StackRole }[] = [];
  const leftOut: { category: CategorySlug; reason: string }[] = [];
  const add = (slug: CategorySlug, role: StackRole = "core") => pick.push({ slug, role });

  if (p.audience === "internal") {
    add("internal_tools");
    add("database", "if_you_build");
    add("hosting", "if_you_build");
    add("auth", "if_you_build");
    if (p.ai) add("llm", "if_you_build");
    for (const c of ["payments", "email", "analytics", "storage", "dns", "secrets", "monitoring"] as CategorySlug[]) {
      leftOut.push({ category: c, reason: "A tool for your own staff doesn't need it." });
    }
    return { pick, leftOut };
  }

  if (p.platform === "mobile") {
    add("mobile_build");
  } else {
    add("hosting");
    if (p.platform === "both") add("mobile_build");
  }
  add("database");
  add("auth");
  if (p.money !== "none") add("payments");
  else leftOut.push({ category: "payments", reason: "Nothing in the description charges money. Ask for it with categories: [\"payments\"]." });
  if (p.ai) add("llm");
  if (p.rag) add("vector");
  if (p.game || (needs.includes("counters") && needs.includes("spiky"))) add("kv");
  if (p.realtime) add("realtime");
  else if (p.game) add("realtime", "optional");
  add("email", p.platform === "mobile" || p.game ? "optional" : "core");
  add("monitoring");
  add("analytics", "optional");
  add("storage", "optional");
  if (p.platform === "mobile") {
    for (const c of ["hosting", "dns", "secrets"] as CategorySlug[]) {
      leftOut.push({ category: c, reason: "A phone app has no web server to host; its backend is the database's API." });
    }
  } else {
    add("secrets", "optional");
    add("dns", "optional");
  }
  return { pick, leftOut };
}

function productLabel(p: Profile, b2b: boolean): string {
  if (p.audience === "internal") return "Staff tool";
  const parts: string[] = [];
  if (p.platform === "mobile") parts.push("Phone app");
  else if (p.platform === "both") parts.push("Web and phone app");
  else if (p.game) parts.push("Web game");
  else parts.push(b2b ? "B2B web app" : "Web app");
  if (p.ai) parts.push(p.rag ? "with AI answers over documents" : "with AI features");
  if (p.money === "users_pay_each_other") parts.push("where users pay each other");
  else if (p.money === "users_pay_you" && isMobile(p)) parts.push("with in-app subscriptions");
  if (p.realtime && !p.game) parts.push("with live collaboration");
  if (p.game && p.shareable) parts.push("built for viral spikes");
  return parts.join(" ");
}

function headlineOrder(p: Profile, b2b: boolean): CategorySlug[] {
  const o: CategorySlug[] = [];
  if (p.audience === "internal") o.push("internal_tools");
  if (isMobile(p)) o.push("mobile_build", ...(p.money !== "none" ? (["payments"] as CategorySlug[]) : []), "database");
  if (p.money === "users_pay_each_other") o.push("payments");
  if (p.ai) o.push("llm", "vector");
  if (p.game) o.push("kv", "hosting", "database");
  if (p.realtime) o.push("realtime");
  if (b2b) o.push("auth", "payments");
  o.push("hosting", "database", "auth", "payments", "email");
  return [...new Set(o)];
}

function catchesFor(p: Profile, needs: Need[]): typeof CATCHES {
  const flags: string[] = [];
  if (p.audience === "internal") {
    if (needs.includes("google_workspace")) flags.push("internal_workspace");
    flags.push("internal");
  } else {
    if (isMobile(p) && p.money === "users_pay_you") flags.push("mobile_paid");
    if (isMobile(p)) flags.push("mobile_social_login", "mobile");
    if (p.money === "users_pay_each_other") flags.push("marketplace");
    if (p.inPerson) flags.push("in_person");
    if (p.ai) flags.push("ai");
    if (p.rag) flags.push("rag");
    if (needs.includes("usage_billing") && p.money !== "none") flags.push("usage_billing");
    if (p.game) flags.push("game");
    if (p.realtime && !p.game) flags.push("realtime");
  }
  return flags.flatMap((f) => CATCHES.filter((c) => c.when === f));
}

const money = (n: number) => (n === 0 ? "$0" : n < 1 ? "under $1" : `$${Math.round(n).toLocaleString("en-US")}`);

/** Product types whose launch plan differs from a tool's default cost: a shareable game can't launch on a free plan that stops at its cap. */
function costLine(stack: StackPick[], tools: Tool[], internal: boolean, ai: boolean, overrides: Record<string, { monthly: number; basis: string }> = {}): CostLine | null {
  const [usersPart, aiPart] = COST_PROFILE.text.split(/(?<=\.)\s+(?=AI apps)/);
  const profileText = internal
    ? `Priced for ${COST_PROFILE.internalStaff} staff.`
    : ai
      ? `${usersPart} ${aiPart.replace(/\s*Internal tools.*$/, "")}`
      : usersPart;
  const core = stack.filter((s) => s.role === "core");
  if (!core.length) return null;
  const items: CostLine["items"] = [];
  const variable: string[] = [];
  for (const s of core) {
    const t = tools.find((x) => x.slug === s.pick.slug);
    if (!t?.cost) continue;
    const o = overrides[t.slug];
    if (o) items.push({ tool: t.slug, name: t.name, monthly: o.monthly, basis: o.basis });
    else if (t.cost.monthly !== null) items.push({ tool: t.slug, name: t.name, monthly: t.cost.monthly, basis: t.cost.basis });
    if (t.cost.variable) variable.push(`${t.name}: ${t.cost.variable}`);
  }
  const total = items.reduce((a, b) => a + b.monthly, 0);
  const paid = items.filter((i) => i.monthly > 0).sort((a, b) => b.monthly - a.monthly);
  const free = items.filter((i) => i.monthly === 0);
  const scale = internal ? "10_staff" : "1k_users";
  const who = internal ? `for ${COST_PROFILE.internalStaff} staff` : `at ${COST_PROFILE.users.toLocaleString("en-US")} users`;
  let text = `About ${money(total)}/month ${who}`;
  if (paid.length) text += `: ${paid.map((i) => `${i.name} ${money(i.monthly)}`).join(" + ")}`;
  if (free.length) text += `${paid.length ? "; " : ": "}$0 for ${free.map((i) => i.name).join(", ")}`;
  text += ".";
  if (variable.length) text += ` Plus ${variable.join("; ")}.`;
  if (internal && items.length === 1) text += ` ${items[0].basis}`;
  return { monthly: Math.round(total * 100) / 100, scale, items, variable, profile: profileText, text };
}

const ASSUMED_TEXT: Record<"platform" | "money" | "audience", (p: Profile) => string> = {
  platform: (p) => (p.platform === "web" ? "a website or web app, not a phone app" : `platform: ${p.platform}`),
  money: (p) => (p.money === "none" ? "no payments between users" : `money: ${p.money}`),
  audience: (p) => (p.audience === "customers" ? "for customers, not your own staff" : "for your own staff"),
};

export function recommendStack(catalog: CatalogSnapshot, input: RecommendInput): Recommendation {
  const { profile, unknown, vague } = detectProfile(input.description, input.answers);
  const coverage = detectCoverage(input.description);

  // Needs: words in the description, plus what the profile implies, plus explicit ones.
  const detected: DetectedNeed[] = detectNeeds(input.description);
  const addNeed = (need: Need, matched: string) => {
    if (!detected.some((d) => d.need === need)) detected.push({ need, matched });
  };
  const dropNeed = (need: Need) => {
    const i = detected.findIndex((d) => d.need === need);
    if (i >= 0) detected.splice(i, 1);
  };
  if (isMobile(profile)) addNeed("mobile", profile.matched.platform ?? "(answered)");
  if (profile.platform === "mobile") dropNeed("nextjs");
  if (profile.money === "users_pay_each_other") addNeed("marketplace", profile.matched.money ?? "(answered)");
  if (profile.audience === "internal") {
    addNeed("internal", profile.matched.audience ?? "(answered)");
    dropNeed("b2b");
  }
  if (profile.realtime) addNeed("realtime", "live collaboration");
  if (profile.game) addNeed("counters", `${profile.matched.game} (scores and streaks)`);
  if (profile.shareable) addNeed("spiky", "players share results");
  if (!profile.rag) dropNeed("rag");
  for (const n of input.needs ?? []) addNeed(n, "(requested)");
  const needs = detected.map((d) => d.need);
  const b2b = needs.includes("b2b");

  // The recipe follows the profile first (what kind of product it is), then plain words.
  const { recipe, note: recipeNote } = routeRecipe(catalog.recipes, profile, input.description, b2b);

  const base = {
    description: input.description,
    productType: { recipe: recipe?.slug ?? null, title: recipe?.title ?? null, label: productLabel(profile, b2b) },
    coverage,
    detectedNeeds: detected.map((d) => ({ need: d.need, label: NEED_LABELS[d.need], matched: d.matched })),
    recipeNote,
    policy: POLICY,
    method: METHOD_URL,
  };
  const profileOut = (assumed: string[]) => ({
    platform: profile.platform,
    money: profile.money,
    audience: profile.audience,
    ai: profile.ai,
    realtime: profile.realtime,
    assumed,
  });

  const explicit = !!input.categories?.length;

  // Out of scope: say so instead of a stack, unless the agent asked for specific categories.
  if (coverage.status === "outside" && !explicit) {
    return {
      ...base,
      productType: { recipe: null, title: null, label: base.productType.label },
      status: "outside_coverage",
      profile: profileOut([]),
      questions: [],
      summary: null,
      stack: [],
      leftOut: [],
      nextStep:
        "Tell the user Cuely doesn't cover this kind of product. If it has ordinary web parts (sign-in, database, email), call recommend_stack again with categories for just those.",
    };
  }

  // Ask before guessing, but only about facts that change the picks.
  if (!input.assumeDefaults && !explicit) {
    const qs: Question[] = [];
    if (vague) qs.push(QUESTIONS.what);
    for (const u of unknown) qs.push(QUESTIONS[u]);
    if (qs.length) {
      const ids = qs.filter((q) => q.id !== "what").map((q) => q.id);
      return {
        ...base,
        status: "needs_answers",
        profile: profileOut([]),
        questions: qs.slice(0, 3),
        summary: null,
        stack: [],
        leftOut: [],
        nextStep: `Ask the user ${qs.length === 1 ? "this question" : "these questions"}, then call recommend_stack again with the same description${
          ids.length ? ` and answers, e.g. answers: { ${ids.map((id) => `${id}: "${QUESTIONS[id].options![0].value}"`).join(", ")} }` : " plus their answer"
        }. If you already know the answers from the conversation, pass them now. If you can't ask, call again with assume_defaults: true.`,
      };
    }
  }

  const assumed = input.assumeDefaults ? unknown.map((u) => ASSUMED_TEXT[u](profile)) : [];

  const using = new Set(
    (input.alreadyUsing ?? []).map((r) => resolveTool(catalog.tools, r)?.slug).filter((s): s is string => !!s),
  );
  const avoid = new Set(
    (input.avoid ?? []).map((r) => resolveTool(catalog.tools, r)?.slug).filter((s): s is string => !!s),
  );

  const plan = explicit
    ? { pick: input.categories!.map((slug) => ({ slug, role: "core" as StackRole })), leftOut: [] }
    : categoriesFor(profile, needs);

  const full = input.detail === "full";
  const stack: StackPick[] = [];
  for (const { slug, role } of plan.pick) {
    const cat = catalog.categories.find((c) => c.slug === slug);
    if (!cat) continue;
    const inCat = catalog.tools.filter((t) => t.category === cat.slug);
    const candidates = inCat.filter((t) => !avoid.has(t.slug));
    if (!candidates.length) continue;

    const recipeItem = recipe?.stack.find((s) => s.category === cat.slug);
    const ranked = candidates
      .map((t) => ({ t, s: scoreTool(t, needs, inCat.length, using.has(t.slug)) + (t.slug === recipeItem?.tool ? RECIPE_BONUS : 0) }))
      .sort((a, b) => b.s - a.s || a.t.baseline - b.t.baseline);

    const top = ranked[0];
    const reason = using.has(top.t.slug)
      ? `You already use ${top.t.name}; nothing you described is worth the cost of switching.`
      : (strongestReason(top.t, needs) ?? (top.t.slug === recipeItem?.tool ? recipeItem.why : top.t.pitch));

    // The recipe says which parts are core for this product type; "only if you build it" stays.
    const finalRole: StackRole = recipeItem && role !== "if_you_build" ? (recipeItem.optional ? "optional" : "core") : role;

    stack.push({
      category: cat.slug,
      categoryName: cat.name,
      role: finalRole,
      optional: finalRole !== "core",
      pick: toCard(top.t, reason),
      alternatives: ranked.slice(1, full ? 3 : 2).map(({ t }) => ({ slug: t.slug, name: t.name, when: alternativeWhen(t) })),
      score: Math.round(top.s * 10) / 10,
    });
  }

  // Summary first: the picks that matter, the catches, and the monthly cost.
  const order = headlineOrder(profile, b2b);
  const core = stack.filter((s) => s.role === "core");
  const picks = [...core]
    .sort((a, b) => {
      const ia = order.indexOf(a.category), ib = order.indexOf(b.category);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .slice(0, 3)
    .map((s) => ({ category: s.category, categoryName: s.categoryName, tool: s.pick.slug, name: s.pick.name, reason: s.pick.reason }));

  const fromProfile = explicit ? [] : catchesFor(profile, needs).map((c) => ({ text: c.text, source: c.source, verifiedOn: c.verifiedOn }));
  const laneSources = new Set(fromProfile.map((c) => c.source));
  const fromPicks = picks
    .map((p) => stack.find((s) => s.category === p.category)!.pick)
    .filter((c) => c.watchOut && !laneSources.has(c.pricingUrl))
    .map((c) => ({ text: `${c.name}: ${c.watchOut}`, source: c.pricingUrl, verifiedOn: c.verifiedOn }));
  const allCatches = [...fromProfile, ...fromPicks];

  const summary: Summary = {
    headline: `${base.productType.label}: ${picks.map((p) => `${p.name} (${/^.[^A-Z]*$/.test(p.categoryName) ? p.categoryName.toLowerCase() : p.categoryName})`).join(", ")}.`,
    picks,
    catches: allCatches.slice(0, 3),
    moreCatches: allCatches.slice(3),
    cost: costLine(stack, catalog.tools, profile.audience === "internal" && !explicit, profile.ai, !explicit ? (recipe?.costOverrides ?? {}) : {}),
  };
  if (summary.cost && !explicit && recipe?.costOverrides?.["cloudflare-workers"] && stack.some((x) => x.pick.slug === "cloudflare-workers" && x.role === "core")) {
    summary.cost.text += " Workers is priced at Paid because Free stops at 100,000 requests a day.";
  }
  if (summary.cost && isMobile(profile) && !explicit) {
    summary.cost.text += ` Plus store accounts: ${STORE_ACCOUNTS}.`;
  }

  const nextStep = recipe
    ? `Call get_recipe with product_type "${recipe.slug}" for the full setup steps, schema and pitfalls.`
    : `No full recipe for this product type yet (available: ${catalog.recipes.map((r) => r.slug).join(", ")}). Call again with detail: "full" for every pick's free plan, prices and alternatives.`;

  return {
    ...base,
    status: "ok",
    profile: profileOut(assumed),
    questions: [],
    summary,
    stack,
    leftOut: plan.leftOut,
    nextStep,
  };
}
