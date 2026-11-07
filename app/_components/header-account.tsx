"use client";

import { SignOutButton, useAuth } from "@clerk/nextjs";

/**
 * The header's account links. Reads Clerk's session in the browser, so it flips to the
 * signed-in state as soon as sign-in finishes, without a reload.
 */
export function HeaderAccount() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    // /account works either way: it shows the account, or sends a visitor to sign in.
    return <a href="/account">Account</a>;
  }
  if (!isSignedIn) return <a href="/auth/sign-in">Sign in</a>;
  return (
    <>
      <a href="/account">Account</a>
      <SignOutButton redirectUrl="/">
        <button type="button" className="nav-button">
          Sign out
        </button>
      </SignOutButton>
    </>
  );
}
