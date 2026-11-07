import type { Metadata } from "next";
import { CuelySignIn } from "../../_clerk";
import { AuthShell } from "../../_shell";

export const metadata: Metadata = { title: "Sign in · Cuely", robots: { index: false } };

export default function SignInPage() {
  return (
    <AuthShell title="Sign in">
      <CuelySignIn />
    </AuthShell>
  );
}
