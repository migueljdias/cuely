import type { ReactNode } from "react";
import { authConfigured } from "@/auth/server";
import { SiteFooter, SiteHeader } from "./chrome";

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap auth">
        <h1 className="page-title">{title}</h1>
        <p className="page-lede">A free account lets your AI tool use Cuely. Sign in with Google or GitHub to get your key.</p>
        {authConfigured() ? (
          <div className="auth-clerk">{children}</div>
        ) : (
          <p className="notice" role="status">
            Accounts aren&apos;t switched on yet.
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
