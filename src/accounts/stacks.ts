import type { ComplianceTopic, Tool } from "@/catalog";
import { TOPIC_LABELS, TOPICS } from "@/freshness/compliance";
import type { QueryFn } from "@/repo";

/**
 * Saved stacks: the tools a project uses, kept on the account so its holder can see when
 * a price, a free plan, a measured outage or a compliance statement changes.
 *
 * Only what the holder typed or picked on the account pages is stored: a name, an optional
 * plain description (used to re-run the stack check) and catalog tool slugs. MCP calls never
 * write here, and nothing here is read by the recommendation engine.
 */

/** The facts about one tool that are worth telling someone about when they change. */
export interface ToolFacts {
  freeTier: string | null;
  paidStartsAt: string | null;
  monthlyCost: number | null;
  health: number;
  compliance: Partial<Record<ComplianceTopic, "yes" | "plan" | "no">>;
}

export interface SavedStack {
  id: number;
  name: string;
  description: string;
  tools: string[];
  /** Each tool's facts when the holder last marked the stack seen. */
  baseline: Record<string, ToolFacts>;
  seenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface StackChange {
  tool: string;
  name: string;
  kind: "free_tier" | "price" | "cost" | "health" | "compliance";
  /** Worse for the holder (price up, outages, a "no"), better, or neither. */
  tone: "worse" | "better" | "neutral";
  text: string;
}

export const MAX_STACK_TOOLS = 40;

export function toolFacts(t: Tool): ToolFacts {
  const compliance: ToolFacts["compliance"] = {};
  for (const topic of TOPICS) {
    const f = t.compliance?.facts[topic];
    if (f) compliance[topic] = f.answer;
  }
  return {
    freeTier: t.freeTier,
    paidStartsAt: t.paidStartsAt,
    monthlyCost: t.cost?.monthly ?? null,
    health: t.health?.score ?? 0,
    compliance,
  };
}

const ANSWER_WORD = { yes: "offered", plan: "offered on some plans", no: "not offered" } as const;
const ANSWER_RANK = { no: 0, plan: 1, yes: 2 } as const;
const shown = (v: string | null) => (v ? `“${v}”` : "none");

/**
 * What changed for each tool between the baseline and today's catalog. Tools added to the
 * stack after the baseline was taken have no baseline and report nothing.
 */
export function stackChanges(baseline: Record<string, ToolFacts>, tools: Tool[]): StackChange[] {
  const out: StackChange[] = [];
  for (const t of tools) {
    const was = baseline[t.slug];
    if (!was) continue;
    const now = toolFacts(t);
    const add = (kind: StackChange["kind"], tone: StackChange["tone"], text: string) => out.push({ tool: t.slug, name: t.name, kind, tone, text });
    if (was.freeTier !== now.freeTier) add("free_tier", "neutral", `Free plan changed from ${shown(was.freeTier)} to ${shown(now.freeTier)}.`);
    if (was.paidStartsAt !== now.paidStartsAt) add("price", "neutral", `Paid plans now start at ${shown(now.paidStartsAt)} (was ${shown(was.paidStartsAt)}).`);
    if (was.monthlyCost !== now.monthlyCost && was.monthlyCost !== null && now.monthlyCost !== null) {
      add(
        "cost",
        now.monthlyCost > was.monthlyCost ? "worse" : "better",
        `Monthly cost at 1,000 users went from $${was.monthlyCost} to $${now.monthlyCost}.`,
      );
    }
    if (was.health !== now.health) {
      const reasons = t.health?.reasons.join(" ") ?? "";
      add(
        "health",
        now.health < was.health ? "worse" : "better",
        `Measured health went from ${signed(was.health)} to ${signed(now.health)}.${reasons ? ` ${reasons}` : ""}`,
      );
    }
    for (const topic of TOPICS) {
      const a = was.compliance[topic];
      const b = now.compliance[topic];
      if (a === b) continue;
      const label = TOPIC_LABELS[topic];
      if (!b) add("compliance", "neutral", `${label}: the vendor's pages no longer say (was ${ANSWER_WORD[a!]}).`);
      else if (!a) add("compliance", b === "no" ? "worse" : "better", `${label}: now stated as ${ANSWER_WORD[b]}.`);
      else add("compliance", ANSWER_RANK[b] < ANSWER_RANK[a] ? "worse" : "better", `${label}: ${ANSWER_WORD[a]} → ${ANSWER_WORD[b]}.`);
    }
  }
  return out;
}

/** A health score with its sign, rounded to one decimal so float sums don't show as -0.30000000000000004. */
const signed = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return r > 0 ? `+${r}` : String(r);
};

/** Today's facts for every tool in the list, keyed by slug: the baseline to store. */
export function baselineFor(tools: Tool[]): Record<string, ToolFacts> {
  return Object.fromEntries(tools.map((t) => [t.slug, toolFacts(t)]));
}

const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);

const toStack = (r: Record<string, any>): SavedStack => ({
  id: Number(r.id),
  name: r.name,
  description: r.description ?? "",
  tools: Array.isArray(r.tools) ? r.tools : [],
  baseline: (parse(r.baseline) ?? {}) as Record<string, ToolFacts>,
  seenAt: new Date(r.seen_at).toISOString(),
  createdAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
});

const clean = (s: { name: string; description: string; tools: string[] }) => ({
  name: s.name.trim().slice(0, 80) || "My stack",
  description: s.description.trim().slice(0, 2000),
  tools: [...new Set(s.tools)].slice(0, MAX_STACK_TOOLS),
});

export function stackStore(query: QueryFn) {
  return {
    async list(userId: string): Promise<SavedStack[]> {
      const rows = await query("select * from saved_stacks where user_id = $1 order by updated_at desc", [userId]);
      return rows.map(toStack);
    },

    async get(userId: string, id: number): Promise<SavedStack | null> {
      const rows = await query("select * from saved_stacks where user_id = $1 and id = $2", [userId, id]);
      return rows[0] ? toStack(rows[0]) : null;
    },

    async count(userId: string): Promise<number> {
      const rows = await query("select count(*)::int as n from saved_stacks where user_id = $1", [userId]);
      return Number(rows[0]?.n ?? 0);
    },

    async create(userId: string, s: { name: string; description: string; tools: string[]; baseline: Record<string, ToolFacts> }): Promise<number> {
      const c = clean(s);
      const rows = await query(
        "insert into saved_stacks (user_id, name, description, tools, baseline) values ($1, $2, $3, $4, $5) returning id",
        [userId, c.name, c.description, c.tools, JSON.stringify(s.baseline)],
      );
      return Number(rows[0].id);
    },

    /**
     * Changes the name, description and tools. Tools that are new to the stack get today's
     * facts as their baseline; tools that stay keep theirs, so a pending change isn't lost.
     */
    async update(userId: string, id: number, s: { name: string; description: string; tools: string[]; fresh: Record<string, ToolFacts> }): Promise<boolean> {
      const current = await this.get(userId, id);
      if (!current) return false;
      const c = clean(s);
      const baseline = Object.fromEntries(c.tools.filter((t) => current.baseline[t] ?? s.fresh[t]).map((t) => [t, current.baseline[t] ?? s.fresh[t]]));
      await query(
        "update saved_stacks set name = $3, description = $4, tools = $5, baseline = $6, updated_at = now() where user_id = $1 and id = $2",
        [userId, id, c.name, c.description, c.tools, JSON.stringify(baseline)],
      );
      return true;
    },

    /** Takes today's facts as the new baseline, clearing the stack's changes. */
    async markSeen(userId: string, id: number, baseline: Record<string, ToolFacts>): Promise<void> {
      await query("update saved_stacks set baseline = $3, seen_at = now() where user_id = $1 and id = $2", [userId, id, JSON.stringify(baseline)]);
    },

    async remove(userId: string, id: number): Promise<void> {
      await query("delete from saved_stacks where user_id = $1 and id = $2", [userId, id]);
    },
  };
}

export type StackStore = ReturnType<typeof stackStore>;

let store: StackStore | null = null;

/** The stack store on DATABASE_URL, or null when no database is configured. */
export async function getStackStore(): Promise<StackStore | null> {
  if (store) return store;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  store = stackStore(async (text, params) => (await sql.query(text, params ?? [])) as Record<string, any>[]);
  return store;
}
