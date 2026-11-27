import type { Tool } from "@/catalog";
import type { SavedStack, StackChange } from "./stacks";

/**
 * Alerts: what the holder should know about the tools in their projects, built from two
 * things only: changes since each project was last marked seen (stackChanges against its
 * baseline), and tools whose measured health is negative right now. Nothing is stored here.
 */

export type AlertType = "compliance" | "outages" | "price" | "better";

export interface Alert {
  key: string;
  type: AlertType;
  tone: StackChange["tone"];
  /** Short label, e.g. "Price". */
  kind: string;
  tool: string;
  toolName: string;
  text: string;
  /** Projects the alert applies to, by id and name. */
  projects: { id: number; name: string; seenAt: string }[];
  /** For changes: which kind, so marking it seen clears only that change. */
  changeKind?: StackChange["kind"];
  /** A change since last seen (can be marked seen), or a measured problem (can't). */
  source: "change" | "measured";
  /** For measured problems: the date the signals were measured. */
  measuredOn?: string;
}

export const ALERT_TYPES: { id: AlertType; label: string }[] = [
  { id: "compliance", label: "Compliance" },
  { id: "outages", label: "Outages" },
  { id: "price", label: "Prices" },
  { id: "better", label: "Better" },
];

const KIND_LABEL: Record<StackChange["kind"], string> = {
  free_tier: "Free plan",
  price: "Price",
  cost: "Cost",
  health: "Health",
  compliance: "Compliance",
};

function typeOf(c: StackChange): AlertType {
  if (c.tone === "better") return "better";
  if (c.kind === "compliance") return "compliance";
  if (c.kind === "health") return "outages";
  return "price";
}

const RANK = { worse: 0, neutral: 1, better: 2 } as const;

/**
 * Every alert across the holder's projects, worst first. The same change in several projects
 * (a shared tool) is one alert naming each project; a measured problem is shown unless the
 * tool already has a health change for the worse.
 */
export function buildAlerts(projects: { stack: SavedStack; tools: Tool[]; changes: StackChange[] }[]): Alert[] {
  const grouped = new Map<string, Alert>();
  for (const p of projects) {
    for (const c of p.changes) {
      const key = `c|${c.tool}|${c.kind}|${c.text}`;
      const where = { id: p.stack.id, name: p.stack.name, seenAt: p.stack.seenAt };
      const g = grouped.get(key);
      if (g) g.projects.push(where);
      else {
        grouped.set(key, {
          key,
          type: typeOf(c),
          tone: c.tone,
          kind: KIND_LABEL[c.kind],
          tool: c.tool,
          toolName: c.name,
          text: c.text,
          projects: [where],
          changeKind: c.kind,
          source: "change",
        });
      }
    }
  }
  const changes = [...grouped.values()].sort((a, b) => RANK[a.tone] - RANK[b.tone]);

  // A health change that already says "worse" carries the same news as the measured problem.
  const healthChanged = new Set(changes.filter((a) => a.changeKind === "health" && a.tone === "worse").map((a) => a.tool));
  const tools = new Map(projects.flatMap((p) => p.tools.map((t) => [t.slug, t] as const)));
  const measured: Alert[] = [...tools.values()]
    .filter((t) => (t.health?.score ?? 0) < 0 && !healthChanged.has(t.slug))
    .sort((a, b) => a.health!.score - b.health!.score)
    .map((t) => ({
      key: `h|${t.slug}`,
      type: "outages",
      tone: "worse",
      kind: "Measured",
      tool: t.slug,
      toolName: t.name,
      text: t.health!.reasons.join(" "),
      projects: projects
        .filter((p) => p.stack.tools.includes(t.slug))
        .map((p) => ({ id: p.stack.id, name: p.stack.name, seenAt: p.stack.seenAt })),
      source: "measured",
      measuredOn: t.health!.measuredOn,
    }));

  return [...changes, ...measured];
}
