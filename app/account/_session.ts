import { cache } from "react";
import { redirect } from "next/navigation";
import { getAccountStore } from "@/accounts/store";
import { projectChecklist, readiness } from "@/accounts/checklist";
import { getStackStore, stackChanges } from "@/accounts/stacks";
import { getRepository } from "@/repo";
import { authConfigured, currentUser } from "@/auth/server";
import { planFor } from "@/plans";

/**
 * The signed-in user, their account row and plan, read once per request and shared by the
 * account layout and whichever page it wraps. Sends visitors who aren't signed in to sign-in.
 */
export const accountSession = cache(async () => {
  if (!authConfigured()) redirect("/sign-in");
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const store = await getAccountStore();
  const account = store ? await store.ensure(user.id, user.email) : null;
  const stacks = await getStackStore();
  return { user, store, account, stacks, plan: planFor(account?.plan) };
});

export function day(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "never";
}

/**
 * Every saved project (a saved stack) with its catalog tools and what changed since its
 * holder last looked. Read once per request: the sidebar badges, Home and Alerts share it.
 */
export const projectsOverview = cache(async () => {
  const { user, stacks: store } = await accountSession();
  const [stacks, snap] = await Promise.all([store ? store.list(user.id) : [], getRepository().then((r) => r.snapshot())]);
  const bySlug = new Map(snap.tools.map((t) => [t.slug, t]));
  const projects = stacks.map((stack) => {
    const tools = stack.tools.map((t) => bySlug.get(t)).filter((t) => t !== undefined);
    return { stack, tools, changes: stackChanges(stack.baseline, tools), ready: readiness(projectChecklist(stack, tools)) };
  });
  const alertCount = projects.reduce((sum, p) => sum + p.changes.length, 0);
  const lastRead = snap.tools.reduce((max, t) => (t.verifiedOn > max ? t.verifiedOn : max), "");
  return { projects, alertCount, snap, lastRead, hasStore: Boolean(store) };
});
