import type { Metadata } from "next";
import { CuelySignUp } from "../../_components/clerk-forms";
import { AuthShell } from "../../_components/auth-shell";

export const metadata: Metadata = { title: "Create an account · Cuely", robots: { index: false } };

export default function SignUpPage() {
  return (
    <AuthShell title="Create your account" lede="A free account lets your AI tool use Cuely. It takes a few seconds.">
      <CuelySignUp />
    </AuthShell>
  );
}
