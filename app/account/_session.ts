import { cache } from "react";
import { redirect } from "next/navigation";
import { getAccountStore } from "@/accounts/store";
import { getStackStore } from "@/accounts/stacks";
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
