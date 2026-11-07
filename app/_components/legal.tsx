import type { ReactNode } from "react";
import { LEGAL_UPDATED } from "@/site";
import { SiteFooter, SiteHeader } from "./chrome";

export function LegalPage({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap legal">
        <h1 className="page-title">{title}</h1>
        <p className="page-lede">{lede}</p>
        <p className="muted small">Last updated {LEGAL_UPDATED}</p>
        <div className="legal-body">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
