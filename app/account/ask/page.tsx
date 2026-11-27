import type { Metadata } from "next";
import { getRepository } from "@/repo";
import { toolOptions } from "../_options";
import { accountSession } from "../_session";
import { Ask } from "./_ask";
import type { AskMode } from "./actions";

export const metadata: Metadata = { title: "Ask Cuely · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AskPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { user, store, stacks, plan } = await accountSession();
  const { mode } = await searchParams;
  const [snap, count, usage] = await Promise.all([
    getRepository().then((r) => r.snapshot()),
    stacks ? stacks.count(user.id) : 0,
    store ? store.usage(user.id, 1) : null,
  ]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = usage ? Math.min(usage.find((u) => u.day === todayIso)?.calls ?? 0, plan.perDay) : 0;
  const initial: AskMode = mode === "check" || mode === "compare" ? mode : "start";

  return (
    <div className="ask-page">
      <div>
        <h1 className="app-h1">Ask Cuely</h1>
        <p className="project-desc">
          The same answers your agent gets over MCP. Each question counts as one tool call; nothing you type is stored unless
          you save it. No vendor pays for placement.
        </p>
      </div>
      <Ask
        options={toolOptions(snap)}
        initialMode={initial}
        canSave={Boolean(stacks) && count < plan.maxStacks}
        usage={usage ? { today, perDay: plan.perDay } : null}
      />
    </div>
  );
}
