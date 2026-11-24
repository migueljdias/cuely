"use client";

import { useAuth } from "@clerk/nextjs";
import { APP_URL } from "@/site";

/**
 * The header's account link: "Sign in" for visitors, "Dashboard" once signed in. Reads Clerk's
 * session in the browser, so it flips as soon as sign-in finishes, without a reload. Signing
 * out lives in the dashboard's sidebar.
 */
export function HeaderAccount() {
  const { isLoaded, isSignedIn } = useAuth();
  // Before the session loads, the dashboard link works either way: it shows the account, or sends a visitor to sign in.
  if (isLoaded && !isSignedIn) return <a href={`${APP_URL}/sign-in`}>Sign in</a>;
  return <a href={`${APP_URL}/account`}>Dashboard</a>;
}
