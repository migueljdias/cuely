/**
 * start_project: everything a new build needs from Cuely in one call.
 *
 * It is recommend_stack without questions (what the description leaves open is
 * assumed and listed), plus the security and compliance to-do list for this
 * product and stack (src/catalog/practices.ts), split into what to set up on day
 * one and what to finish before launch.
 */
import type { CategorySlug } from "@/catalog";
import { practicesFor, type Phase, type PracticeArea } from "@/catalog/practices";
import type { Answers } from "./profile";
import { recommendStack, resolveTool, type CatalogSnapshot, type Recommendation } from "./recommend";
import type { Need } from "@/catalog";

export interface StartInput {
  description: string;
  answers?: Answers;
  needs?: Need[];
  alreadyUsing?: string[];
  avoid?: string[];
}

export interface ChecklistItem {
  id: string;
  area: PracticeArea;
  phase: Phase;
  title: string;
  detail: string;
  why: string;
  source: string;
}

export interface ProjectStart {
  status: Recommendation["status"];
  recommendation: Recommendation;
  checklist: ChecklistItem[];
  nextStep: string;
}

export function startProject(catalog: CatalogSnapshot, input: StartInput): ProjectStart {
  const rec = recommendStack(catalog, {
    description: input.description,
    answers: input.answers,
    needs: input.needs,
    alreadyUsing: input.alreadyUsing,
    avoid: input.avoid,
    assumeDefaults: true,
  });
  if (rec.status !== "ok") return { status: rec.status, recommendation: rec, checklist: [], nextStep: rec.nextStep };

  const using = (input.alreadyUsing ?? []).map((r) => resolveTool(catalog.tools, r)).filter((t) => !!t);
  const tools = [...new Set([...rec.stack.map((s) => s.pick.slug), ...using.map((t) => t!.slug)])];
  const categories = [...new Set([...rec.stack.map((s) => s.category), ...using.map((t) => t!.category)])] as CategorySlug[];
  const needs = rec.detectedNeeds.map((d) => d.need);

  const checklist = practicesFor({
    platform: rec.profile.platform,
    money: rec.profile.money,
    audience: rec.profile.audience,
    ai: rec.profile.ai,
    rag: needs.includes("rag"),
    game: rec.productType.recipe === "daily-web-game" || needs.includes("counters") && needs.includes("spiky"),
    needs,
    tools,
    categories,
    push: rec.stack.some((s) => s.category === "push" && s.role === "core"),
  }).map(({ id, area, phase, title, detail, why, source }) => ({ id, area, phase, title, detail, why, source }));

  const recipe = rec.productType.recipe;
  const nextStep = [
    recipe ? `Call get_recipe with product_type "${recipe}" for the setup steps, then build.` : "Set up the core picks, then build.",
    "Save the checklist into the repo (for example docs/launch-checklist.md) and tick items off as they are done.",
    "Once the project is under way, call check_project with the tools it uses to see whether anything should change.",
  ].join(" ");

  return { status: "ok", recommendation: rec, checklist, nextStep };
}
