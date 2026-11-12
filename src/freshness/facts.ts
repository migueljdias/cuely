/**
 * Price and limit facts that the weekly job re-reads from each vendor's pricing page
 * (scripts/update-facts.ts) and stores in data/facts.json. The catalog lays them over
 * the hand-written entry, so a price change reaches every answer without a person
 * editing src/catalog.
 *
 * A model proposes the new wording; this file decides whether it is published. A
 * proposal is only accepted when every dollar amount it quotes is on the page as read
 * that day and the monthly cost hasn't jumped. Anything else is left as it was and
 * reported for a person to look at.
 */
import type { Tool, ToolCost } from "@/catalog/types";
import { dollarAmounts } from "./pricing";

/** What the job changed for one tool. Fields that are absent keep the catalog's value. */
export interface FactUpdate {
  freeTier?: string | null;
  paidStartsAt?: string | null;
  cost?: Pick<ToolCost, "monthly" | "basis" | "variable">;
  /** Date the facts were last checked against the page (YYYY-MM-DD). */
  verifiedOn: string;
}

export interface FactsFile {
  tools: Record<string, FactUpdate>;
}

/** The facts a model is shown and may restate. */
export interface Facts {
  freeTier: string | null;
  paidStartsAt: string | null;
  cost: Pick<ToolCost, "monthly" | "basis" | "variable"> | null;
}

/** What the model answered for one tool. */
export interface Proposal extends Facts {
  /** "unchanged": the page still says what the catalog says. "update": it doesn't. "unsure": can't tell from these lines. */
  verdict: "unchanged" | "update" | "unsure";
  /** One sentence on what changed or why it can't tell. */
  note: string;
}

export type Decision =
  | { action: "confirm"; update: FactUpdate }
  | { action: "publish"; update: FactUpdate }
  | { action: "hold"; why: string };

/** A monthly cost may move by this much on its own; a bigger jump waits for a person. */
export const MAX_COST_STEP = 50;
export const MAX_COST_RATIO = 3;

export function factsOf(tool: Pick<Tool, "freeTier" | "paidStartsAt" | "cost">): Facts {
  const c = tool.cost;
  return {
    freeTier: tool.freeTier,
    paidStartsAt: tool.paidStartsAt,
    cost: c ? { monthly: c.monthly, basis: c.basis, ...(c.variable ? { variable: c.variable } : {}) } : null,
  };
}

/** Lays an update over a catalog entry. */
export function applyFacts<T extends Pick<Tool, "freeTier" | "paidStartsAt" | "cost" | "verifiedOn">>(tool: T, update: FactUpdate | undefined): T {
  if (!update) return tool;
  const out = { ...tool, verifiedOn: update.verifiedOn };
  if (update.freeTier !== undefined) out.freeTier = update.freeTier;
  if (update.paidStartsAt !== undefined) out.paidStartsAt = update.paidStartsAt;
  if (update.cost) {
    const { variable, ...rest } = update.cost;
    const kept = { ...tool.cost, ...rest } as ToolCost;
    if (variable) kept.variable = variable;
    else delete kept.variable;
    out.cost = kept;
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Decides what to do with a model's proposal, given the facts it was shown and the
 * page's price lines as read today.
 */
export function decide(current: Facts, proposal: Proposal, pageLines: string[], today: string): Decision {
  if (proposal.verdict === "unsure") return { action: "hold", why: proposal.note || "The model couldn't tell from the page." };
  if (proposal.verdict === "unchanged") return { action: "confirm", update: { verifiedOn: today } };

  const update: FactUpdate = { verifiedOn: today };
  if (!same(proposal.freeTier, current.freeTier)) update.freeTier = proposal.freeTier;
  if (!same(proposal.paidStartsAt, current.paidStartsAt)) update.paidStartsAt = proposal.paidStartsAt;
  if (proposal.cost && !same(proposal.cost, current.cost)) {
    update.cost = { monthly: proposal.cost.monthly, basis: proposal.cost.basis, ...(proposal.cost.variable ? { variable: proposal.cost.variable } : {}) };
  }
  if (Object.keys(update).length === 1) return { action: "confirm", update };

  // Every amount the new wording quotes must be on the page (or be the computed monthly total).
  const onPage = new Set(dollarAmounts(pageLines.join("\n")));
  const computed = update.cost?.monthly != null ? dollarAmounts(`$${update.cost.monthly}`) : [];
  const quoted = dollarAmounts([update.freeTier, update.paidStartsAt, update.cost?.basis, update.cost?.variable].filter(Boolean).join("\n"));
  const invented = quoted.filter((a) => !onPage.has(a) && !computed.includes(a));
  if (invented.length) return { action: "hold", why: `The proposed wording quotes ${invented.join(", ")}, which isn't on the page.` };

  if (update.cost) {
    const was = current.cost?.monthly ?? null;
    const now = update.cost.monthly;
    if ((was === null) !== (now === null)) return { action: "hold", why: `The monthly cost would go from ${was ?? "unknown"} to ${now ?? "unknown"}.` };
    if (was !== null && now !== null) {
      const jump = Math.abs(now - was) > MAX_COST_STEP || (Math.min(was, now) > 0 && Math.max(was, now) / Math.min(was, now) > MAX_COST_RATIO);
      if (jump) return { action: "hold", why: `The monthly cost would jump from $${was} to $${now}.` };
    }
  }
  return { action: "publish", update };
}
