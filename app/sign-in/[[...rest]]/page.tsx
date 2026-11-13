import type { Metadata } from "next";
import { CuelySignIn } from "../../_components/clerk-forms";
import { AuthShell } from "../../_components/auth-shell";

export const metadata: Metadata = { title: "Sign in · Cuely", robots: { index: false } };

export default function SignInPage() {
  return (
    <AuthShell title="Welcome back" lede="Sign in to get your API key and see your usage.">
      <CuelySignIn />
    </AuthShell>
  );
}
