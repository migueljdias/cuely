"use server";

import { checkProject, type ProjectCheck } from "@/engine/check";
import { compareTools, type CompareResult } from "@/engine/compare";
import { startProject, type ProjectStart } from "@/engine/start";
import { getRepository } from "@/repo";
import { accountSession } from "../_session";

export type AskMode = "start" | "check" | "compare";

export type AskState =
  | null
  | { error: string }
  | { mode: "start"; description: string; result: ProjectStart }
  | { mode: "check"; description: string; using: string[]; result: ProjectCheck }
  | { mode: "compare"; result: CompareResult };

const text = (form: FormData, key: string, max = 2000) => String(form.get(key) ?? "").trim().slice(0, max);

/**
 * Ask Cuely from the account pages: the same engine, rules and answers as the MCP tools.
 * Each question counts as one tool call against the account's daily limit, like an agent's.
 * Nothing typed here is stored or logged; only "Save as a stack" keeps anything.
 */
export async function askAction(_prev: AskState, form: FormData): Promise<AskState> {
  const { user, store, plan } = await accountSession();
  const mode = text(form, "mode", 10) as AskMode;
  const description = text(form, "description");

  if (mode !== "compare" && description.length < 3) return { error: "Describe the product in a sentence or two first." };
  const using =
    mode === "check"
      ? form
          .getAll("tools")
          .map(String)
          .flatMap((v) => v.split(","))
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 40)
      : [];
  if (mode === "check" && !using.length) return { error: "Add the tools the project uses now." };
  const a = text(form, "a", 100);
  const b = text(form, "b", 100);
  if (mode === "compare" && (!a || !b)) return { error: "Pick two tools to compare." };
  if (!["start", "check", "compare"].includes(mode)) return { error: "Pick what to ask." };

  if (store) {
    const usage = await store.countRequest(user.id, 1);
    if (usage.calls <= plan.perDay) {
      const tool = mode === "start" ? "start_project" : mode === "check" ? "check_project" : "compare_tools";
      await store.countDetail(user.id, "ask", [tool]).catch((err) => console.error("usage detail failed", err));
    }
    if (usage.calls > plan.perDay) {
      return {
        error: `You've used today's ${plan.perDay.toLocaleString("en-US")} tool calls on the ${plan.name} plan. They reset at 00:00 UTC.${plan.id === "free" ? " Pro raises the limit." : ""}`,
      };
    }
  }

  const snap = await (await getRepository()).snapshot();
  if (mode === "start") return { mode, description, result: startProject(snap, { description }) };
  if (mode === "check") return { mode, description, using, result: checkProject(snap, { description, using }) };
  return { mode, result: compareTools(snap, { a, b, context: description || undefined }) };
}
