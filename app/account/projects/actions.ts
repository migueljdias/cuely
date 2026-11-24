"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { baselineFor, MAX_STACK_TOOLS } from "@/accounts/stacks";
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
  if (!stacks) return { error: "Saved stacks need a database, and none is configured here." };
  const f = await readForm(form);
  if (!f.tools.length) return { error: "Add at least one tool Cuely knows. Start typing a name to see the list." };
  if ((await stacks.count(user.id)) >= plan.maxStacks) {
    return {
      error:
        plan.id === "free"
          ? `The Free plan saves ${plan.maxStacks} stacks. Delete one, or upgrade to Pro for more.`
          : `You have ${plan.maxStacks} stacks. Delete one to save another.`,
    };
  }
  const id = await stacks.create(user.id, { name: f.name, description: f.description, tools: f.tools.map((t) => t.slug), baseline: baselineFor(f.tools) });
  revalidatePath("/account", "layout");
  redirect(`/account/stacks/${id}?saved=1`);
}

export async function updateStackAction(_prev: StackFormState, form: FormData): Promise<StackFormState> {
  const { user, stacks } = await accountSession();
  const id = stackId(form);
  if (!stacks || !id) return { error: "That stack wasn't found." };
  const f = await readForm(form);
  if (!f.tools.length) return { error: "A stack needs at least one tool. Delete it instead if you're done with it." };
  const ok = await stacks.update(user.id, id, { name: f.name, description: f.description, tools: f.tools.map((t) => t.slug), fresh: baselineFor(f.tools) });
  if (!ok) return { error: "That stack wasn't found." };
  revalidatePath("/account", "layout");
  redirect(`/account/stacks/${id}`);
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
  redirect("/account/stacks");
}
