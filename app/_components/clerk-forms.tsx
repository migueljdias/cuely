"use client";

import { useSyncExternalStore } from "react";
import { SignIn, SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "@/auth/appearance";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True when the visitor's system is in dark mode; light on the server. */
function usePrefersDark() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

export function CuelySignIn() {
  const dark = usePrefersDark();
  return (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      forceRedirectUrl="/account"
      fallbackRedirectUrl="/account"
      appearance={clerkAppearance(dark)}
    />
  );
}

export function CuelySignUp() {
  const dark = usePrefersDark();
  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      forceRedirectUrl="/account"
      fallbackRedirectUrl="/account"
      appearance={clerkAppearance(dark)}
    />
  );
}
