import { clerkClient, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";

/**
 * True when Clerk keys are set. Without them the site still runs: the MCP works with no
 * account, and the sign-in pages say sign-in isn't on yet. The publishable key is read at
 * build time, so adding the keys needs a redeploy.
 */
export function authConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  /** The profile picture the user uploaded (or brought from Google/GitHub); null when they have none. */
  imageUrl: string | null;
}

/** The signed-in user, or null. Never throws. */
export async function currentUser(): Promise<SessionUser | null> {
  if (!authConfigured()) return null;
  try {
    const u = await clerkCurrentUser();
    if (!u) return null;
    const email =
      u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
      u.emailAddresses[0]?.emailAddress ??
      null;
    const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
    return { id: u.id, email, name, imageUrl: u.hasImage ? u.imageUrl : null };
  } catch (err) {
    console.warn("[auth] currentUser failed", err);
    return null;
  }
}

/** Deletes the user at Clerk, which also ends all their sessions. Throws on failure. */
export async function deleteAuthUser(userId: string): Promise<void> {
  if (!authConfigured()) throw new Error("Sign-in isn't configured.");
  const client = await clerkClient();
  await client.users.deleteUser(userId);
}
