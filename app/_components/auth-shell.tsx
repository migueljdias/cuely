import type { ReactNode } from "react";
import { authConfigured } from "@/auth/server";
import { SiteFooter, SiteHeader } from "./chrome";

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap auth">
        <h1 className="page-title">{title}</h1>
        <p className="page-lede">You don&apos;t need an account to use Cuely. Sign in for an API key and your plan.</p>
        {authConfigured() ? (
          <div className="auth-clerk">{children}</div>
        ) : (
          <p className="notice" role="status">
            Accounts aren&apos;t switched on yet. Cuely works without one: connect your agent from the home page.
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
