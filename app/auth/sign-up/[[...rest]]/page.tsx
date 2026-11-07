import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "@/auth/appearance";
import { AuthShell } from "../../_shell";

export const metadata: Metadata = { title: "Create an account · Cuely", robots: { index: false } };

export default function SignUpPage() {
  return (
    <AuthShell title="Create an account">
      <SignUp
        routing="path"
        path="/auth/sign-up"
        signInUrl="/auth/sign-in"
        fallbackRedirectUrl="/account"
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}
