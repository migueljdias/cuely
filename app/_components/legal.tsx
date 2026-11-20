import type { ReactNode } from "react";
import { LEGAL_UPDATED } from "@/site";
import { SiteFooter, SiteHeader } from "./chrome";

export function LegalPage({
  title,
  lede,
  actions,
  children,
}: {
  title: string;
  lede: string;
  /** Optional row under the lede, such as a link out to the source. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap legal">
        <h1 className="page-title">{title}</h1>
        <p className="page-lede">{lede}</p>
        {actions ? <div className="page-actions">{actions}</div> : null}
        <p className="muted small">Last updated {LEGAL_UPDATED}</p>
        <div className="legal-body">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
