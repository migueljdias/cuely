import { authConfigured } from "@/auth/server";
import { APP_URL, SITE_URL } from "@/site";
import { HeaderAccount } from "./header-account";

function Logo({ small = false }: { small?: boolean }) {
  const h = small ? 22 : 28;
  return (
    <a href={`${SITE_URL}/`} className={`wordmark${small ? " small" : ""}`} aria-label="Cuely home">
      <picture>
        <source srcSet="/brand/cuely-logo-dark.svg" media="(prefers-color-scheme: dark)" />
        <img src="/brand/cuely-logo-light.svg" alt="Cuely" width={Math.round((h * 712.5) / 224)} height={h} />
      </picture>
    </a>
  );
}

export function SiteHeader() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="nav wrap">
        <Logo />
        <nav aria-label="Primary">
          <a className="nav-wide" href={`${SITE_URL}/#how`}>
            How it works
          </a>
          <a className="nav-wide" href={`${SITE_URL}/#connect`}>
            Connect
          </a>
          <a href={`${SITE_URL}/pricing`}>Pricing</a>
          {authConfigured() ? <HeaderAccount /> : <a href={`${APP_URL}/sign-in`}>Sign in</a>}
        </nav>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer wrap">
      <Logo small />
      <nav className="footer-links" aria-label="Footer">
        <a href={`${SITE_URL}/pricing`}>Pricing</a>
        <a href={`${SITE_URL}/#method`}>Method</a>
        <a href={`${SITE_URL}/llms.txt`}>llms.txt</a>
        <a href={`${SITE_URL}/privacy`}>Privacy</a>
        <a href={`${SITE_URL}/terms`}>Terms</a>
      </nav>
      <p className="muted">© 2026 Cuely</p>
    </footer>
  );
}
