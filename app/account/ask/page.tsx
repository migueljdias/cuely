import type { Metadata } from "next";
import { getRepository } from "@/repo";
import { toolOptions } from "../_options";
import { accountSession } from "../_session";
import { Ask } from "./_ask";
import type { AskMode } from "./actions";

export const metadata: Metadata = { title: "Ask Cuely · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AskPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { user, stacks, plan } = await accountSession();
  const { mode } = await searchParams;
  const [snap, count] = await Promise.all([getRepository().then((r) => r.snapshot()), stacks ? stacks.count(user.id) : 0]);
  const initial: AskMode = mode === "check" || mode === "compare" ? mode : "start";

  return (
    <div className="account">
      <div className="app-section">
        <h1 className="app-title">Ask Cuely</h1>
        <p className="app-lede">
          The same engine and answers your agent gets over MCP, without opening an editor. Picks come from published rules;
          no vendor pays for placement.
        </p>
      </div>
      <Ask options={toolOptions(snap)} initialMode={initial} canSave={Boolean(stacks) && count < plan.maxStacks} />
    </div>
  );
}
