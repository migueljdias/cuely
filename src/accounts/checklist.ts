import type { CategorySlug, Tool } from "@/catalog";
import { practicesFor, type Phase, type PracticeArea } from "@/catalog/practices";
import { readProduct } from "@/engine/recommend";

/**
 * A saved project's launch checklist and readiness score.
 *
 * The items are the same practices start_project hands an agent, picked from what the
 * holder typed about the project and the tools they saved, never from anything else.
 * Ticks are stored on the project (saved_stacks.checks); readiness is worked out here.
 */

export interface ProjectCheckItem {
  id: string;
  area: PracticeArea;
  phase: Phase;
  title: string;
  detail: string;
  why: string;
  source: string;
  /** Compliance items are legal obligations (a BAA, a DPA, a privacy policy): launch waits on them. */
  blocks: boolean;
  /** The date it was ticked, or null. */
  doneOn: string | null;
}

export interface Readiness {
  /** Ticked items as a whole percentage of all items. */
  pct: number;
  done: number;
  total: number;
  /** Blocking items not yet ticked. */
  blockersLeft: number;
  areas: { area: PracticeArea; label: string; done: number; total: number }[];
}

export const AREA_LABELS: Record<PracticeArea, string> = {
  compliance: "Compliance",
  security: "Security",
  payments: "Payments",
  privacy: "Privacy",
  ai: "AI",
  app_stores: "App stores",
};

export const PHASE_LABELS: Record<Phase, string> = {
  day_one: "Before real data goes in",
  before_launch: "Before launch",
};

export function projectChecklist(project: { description: string; checks: Record<string, string> }, tools: Tool[]): ProjectCheckItem[] {
  const { profile, needs } = readProduct(project.description);
  const categories = [...new Set(tools.map((t) => t.category))] as CategorySlug[];
  return practicesFor({
    platform: profile.platform,
    money: profile.money,
    audience: profile.audience,
    ai: profile.ai,
    rag: needs.includes("rag"),
    game: profile.game,
    needs,
    tools: tools.map((t) => t.slug),
    categories,
    push: categories.includes("push"),
    agent: profile.agent,
  }).map(({ id, area, phase, title, detail, why, source }) => ({
    id,
    area,
    phase,
    title,
    detail,
    why,
    source,
    blocks: area === "compliance",
    doneOn: project.checks[id] ?? null,
  }));
}

export function readiness(items: ProjectCheckItem[]): Readiness {
  const done = items.filter((i) => i.doneOn).length;
  const areas = (Object.keys(AREA_LABELS) as PracticeArea[])
    .map((area) => {
      const list = items.filter((i) => i.area === area);
      return { area, label: AREA_LABELS[area], done: list.filter((i) => i.doneOn).length, total: list.length };
    })
    .filter((a) => a.total > 0);
  return {
    pct: items.length ? Math.round((done / items.length) * 100) : 0,
    done,
    total: items.length,
    blockersLeft: items.filter((i) => i.blocks && !i.doneOn).length,
    areas,
  };
}

/** The checklist as Markdown, to save in the project's repo (docs/launch-checklist.md). */
export function checklistMarkdown(name: string, items: ProjectCheckItem[]): string {
  const lines = [`# Launch checklist: ${name}`, "", "From Cuely (cuely.dev). Tick items off here or on your Cuely project page.", ""];
  for (const phase of Object.keys(PHASE_LABELS) as Phase[]) {
    const list = items.filter((i) => i.phase === phase);
    if (!list.length) continue;
    lines.push(`## ${PHASE_LABELS[phase]}`, "");
    for (const i of list) {
      lines.push(`- [${i.doneOn ? "x" : " "}] **${i.title}**${i.blocks ? " (blocks launch)" : ""}`);
      lines.push(`  ${i.detail}`);
      lines.push(`  Why: ${i.why} Source: ${i.source}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
