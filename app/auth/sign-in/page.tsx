import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../../_components/chrome";
import { AuthForm } from "../_form";
import { signInAction } from "../actions";

export const metadata: Metadata = { title: "Sign in · Cuely", robots: { index: false } };

export default function SignIn() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap auth">
        <h1 className="page-title">Sign in</h1>
        <p className="page-lede">You don&apos;t need an account to use Cuely. Sign in for an API key and your plan.</p>
        <AuthForm mode="sign-in" action={signInAction} />
        <p className="auth-switch">
          New here? <a href="/auth/sign-up">Create an account</a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
