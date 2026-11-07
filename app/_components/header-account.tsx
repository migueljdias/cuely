"use client";

import { SignOutButton, useAuth } from "@clerk/nextjs";
import { APP_URL, SITE_URL } from "@/site";

/**
 * The header's account links. Reads Clerk's session in the browser, so it flips to the
 * signed-in state as soon as sign-in finishes, without a reload.
 */
export function HeaderAccount() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    // The account page works either way: it shows the account, or sends a visitor to sign in.
    return <a href={`${APP_URL}/account`}>Account</a>;
  }
  if (!isSignedIn) return <a href={`${APP_URL}/sign-in`}>Sign in</a>;
  return (
    <>
      <a href={`${APP_URL}/account`}>Account</a>
      <SignOutButton redirectUrl={`${SITE_URL}/`}>
        <button type="button" className="nav-button">
          Sign out
        </button>
      </SignOutButton>
    </>
  );
}
