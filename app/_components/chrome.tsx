import { authConfigured } from "@/auth/server";
import { HeaderAccount } from "./header-account";

function Logo({ small = false }: { small?: boolean }) {
  const h = small ? 22 : 28;
  return (
    <a href="/" className={`wordmark${small ? " small" : ""}`} aria-label="Cuely home">
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
          <a className="nav-wide" href="/#how">
            How it works
          </a>
          <a className="nav-wide" href="/#connect">
            Connect
          </a>
          <a href="/pricing">Pricing</a>
          {authConfigured() ? <HeaderAccount /> : <a href="/account">Sign in</a>}
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
        <a href="/pricing">Pricing</a>
        <a href="/#method">Method</a>
        <a href="/llms.txt">llms.txt</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
      <p className="muted">© 2026 Cuely</p>
    </footer>
  );
}
