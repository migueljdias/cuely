import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../_components/chrome";
import { AuthForm } from "../_form";
import { signUpAction } from "../actions";

export const metadata: Metadata = { title: "Create an account · Cuely", robots: { index: false } };

export default function SignUp() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap auth">
        <h1 className="page-title">Create an account</h1>
        <p className="page-lede">Free, and optional. It gets you an API key and a plan; the answers stay the same.</p>
        <AuthForm mode="sign-up" action={signUpAction} />
        <p className="auth-switch">
          Already have one? <a href="/auth/sign-in">Sign in</a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
