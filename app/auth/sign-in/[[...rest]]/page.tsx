import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/auth/appearance";
import { AuthShell } from "../../_shell";

export const metadata: Metadata = { title: "Sign in · Cuely", robots: { index: false } };

export default function SignInPage() {
  return (
    <AuthShell title="Sign in">
      <SignIn
        routing="path"
        path="/auth/sign-in"
        signUpUrl="/auth/sign-up"
        fallbackRedirectUrl="/account"
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}
