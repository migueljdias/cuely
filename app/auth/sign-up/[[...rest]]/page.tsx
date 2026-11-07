import type { Metadata } from "next";
import { CuelySignUp } from "../../_clerk";
import { AuthShell } from "../../_shell";

export const metadata: Metadata = { title: "Create an account · Cuely", robots: { index: false } };

export default function SignUpPage() {
  return (
    <AuthShell title="Create an account">
      <CuelySignUp />
    </AuthShell>
  );
}
