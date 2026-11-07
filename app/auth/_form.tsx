"use client";

import { useActionState, useState } from "react";
import { authClient } from "@/auth/client";
import type { FormState } from "./actions";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

export function AuthForm({ mode, action }: { mode: "sign-in" | "sign-up"; action: Action }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialPending, setSocialPending] = useState(false);
  const signUp = mode === "sign-up";

  async function google() {
    setSocialError(null);
    setSocialPending(true);
    try {
      const res = await authClient.signIn.social({ provider: "google", callbackURL: "/account" });
      if (res?.error) setSocialError(res.error.message ?? "Google sign-in didn't work. Try email instead.");
    } catch {
      setSocialError("Google sign-in didn't work. Try email instead.");
    } finally {
      setSocialPending(false);
    }
  }

  return (
    <div className="auth-card">
      <button type="button" className="btn btn-quiet btn-block" onClick={google} disabled={socialPending}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
        </svg>
        Continue with Google
      </button>
      {socialError && (
        <p className="form-error" role="alert">
          {socialError}
        </p>
      )}
      <p className="auth-or">or with email</p>
      <form action={formAction} className="form">
        {signUp && (
          <label className="field">
            <span>Name</span>
            <input name="name" type="text" autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required autoComplete="email" inputMode="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={signUp ? "new-password" : "current-password"}
          />
        </label>
        {state?.error && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          {pending ? (signUp ? "Creating your account…" : "Signing in…") : signUp ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
