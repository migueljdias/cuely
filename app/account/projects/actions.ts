"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { baselineFor, MAX_STACK_TOOLS, seenFacts, toolFacts, type StackChange } from "@/accounts/stacks";
import { resolveTool } from "@/engine/recommend";
import { getRepository } from "@/repo";
import { accountSession } from "../_session";

export type StackFormState = { error?: string } | null;

/** The form's tools as catalog tools: slugs from the picker, or names typed in. Unknown names are dropped. */
async function readForm(form: FormData) {
  const snap = await (await getRepository()).snapshot();
  const refs = form.getAll("tools").map(String).flatMap((v) => v.split(","));
  const tools = [...new Map(refs.map((r) => resolveTool(snap.tools, r.trim())).filter((t) => t !== null).map((t) => [t.slug, t])).values()];
  return {
    name: String(form.get("name") ?? ""),
    description: String(form.get("description") ?? ""),
    tools: tools.slice(0, MAX_STACK_TOOLS),
  };
}

const stackId = (form: FormData) => {
  const id = Number(form.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function createStackAction(_prev: StackFormState, form: FormData): Promise<StackFormState> {
  const { user, stacks, plan } = await accountSession();
  if (!stacks) return { error: "Projects need a database, and none is configured here." };
  const f = await readForm(form);
  if (!f.tools.length) return { error: "Add at least one tool Cuely knows. Start typing a name to see the list." };
  if ((await stacks.count(user.id)) >= plan.maxStacks) {
    return {
      error:
        plan.id === "free"
          ? `The Free plan keeps ${plan.maxStacks} projects. Delete one, or upgrade to Pro for more.`
          : `You have ${plan.maxStacks} projects. Delete one to add another.`,
    };
  }
  const id = await stacks.create(user.id, { name: f.name, description: f.description, tools: f.tools.map((t) => t.slug), baseline: baselineFor(f.tools) });
  revalidatePath("/account", "layout");
  redirect(`/account/projects/${id}?saved=1`);
}

export async function updateStackAction(_prev: StackFormState, form: FormData): Promise<StackFormState> {
  const { user, stacks } = await accountSession();
  const id = stackId(form);
  if (!stacks || !id) return { error: "That project wasn't found." };
  const f = await readForm(form);
  if (!f.tools.length) return { error: "A project needs at least one tool. Delete it instead if you're done with it." };
  const ok = await stacks.update(user.id, id, { name: f.name, description: f.description, tools: f.tools.map((t) => t.slug), fresh: baselineFor(f.tools) });
  if (!ok) return { error: "That project wasn't found." };
  revalidatePath("/account", "layout");
  redirect(`/account/projects/${id}`);
}

/** Takes today's facts as the stack's baseline, so the changes it showed are cleared. */
export async function markSeenAction(form: FormData): Promise<void> {
  const { user, stacks } = await accountSession();
  const id = stackId(form);
  if (!stacks || !id) return;
  const stack = await stacks.get(user.id, id);
  if (!stack) return;
  const snap = await (await getRepository()).snapshot();
  await stacks.markSeen(user.id, id, baselineFor(snap.tools.filter((t) => stack.tools.includes(t.slug))));
  revalidatePath("/account", "layout");
}

export async function deleteStackAction(form: FormData): Promise<void> {
  const { user, stacks } = await accountSession();
  const id = stackId(form);
  if (stacks && id) await stacks.remove(user.id, id);
  revalidatePath("/account", "layout");
  redirect("/account/projects");
}

/** Ticks or unticks one launch checklist item on a project. */
export async function setCheckAction(id: number, practiceId: string, done: boolean): Promise<{ ok: boolean }> {
  const { user, stacks } = await accountSession();
  if (!stacks || !Number.isInteger(id) || id <= 0) return { ok: false };
  try {
    await stacks.setCheck(user.id, id, practiceId, done);
  } catch (e) {
    console.error("setCheck failed", e);
    return { ok: false };
  }
  revalidatePath("/account", "layout");
  return { ok: true };
}

const KINDS: StackChange["kind"][] = ["free_tier", "price", "cost", "health", "compliance"];

/**
 * Clears one alert: in each project the alert names, the fields behind that kind of change
 * take today's value, so the tool's other changes stay.
 */
export async function markToolSeenAction(form: FormData): Promise<void> {
  const { user, stacks } = await accountSession();
  const slug = String(form.get("tool") ?? "");
  const kind = String(form.get("kind") ?? "") as StackChange["kind"];
  const ids = form.getAll("id").map(Number).filter((id) => Number.isInteger(id) && id > 0);
  if (!stacks || !slug || !KINDS.includes(kind) || !ids.length) return;
  const tool = (await (await getRepository()).snapshot()).tools.find((t) => t.slug === slug);
  if (!tool) return;
  const now = toolFacts(tool);
  for (const id of ids) {
    const stack = await stacks.get(user.id, id);
    if (stack) await stacks.markToolSeen(user.id, id, slug, seenFacts(stack.baseline[slug], now, kind));
  }
  revalidatePath("/account", "layout");
}
