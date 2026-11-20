import { authConfigured } from "@/auth/server";
import { APP_URL, SITE_URL, SUPPORT_EMAIL } from "@/site";
import { HeaderAccount } from "./header-account";
import { NavMenu } from "./nav-menu";

/*
  The header and footer every page shares. The header sticks to the top, turns its links
  into a slide-down menu on narrow screens, and the footer lists every section of the site.
  Styles: the "Site chrome" block in globals.css.
*/

const LINKS = [
  { href: `${SITE_URL}/recipes`, label: "Recipes" },
  { href: `${SITE_URL}/tools`, label: "Tools" },
  { href: `${SITE_URL}/#method`, label: "Method" },
  { href: `${SITE_URL}/pricing`, label: "Pricing" },
];

function Logo({ small = false }: { small?: boolean }) {
  const h = small ? 24 : 28;
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
      <header className="site-nav" id="site-nav">
        <div className="site-nav-bar">
          <Logo />
          <nav className="site-nav-links" aria-label="Primary">
            {LINKS.map((l) => (
              <a key={l.label} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="site-nav-right">
            <span className="site-nav-acct">{authConfigured() ? <HeaderAccount /> : <a href={`${APP_URL}/sign-in`}>Sign in</a>}</span>
            <a className="pill pill-solid" href={`${SITE_URL}/start`}>
              Get started
            </a>
            <NavMenu links={LINKS} signInHref={`${APP_URL}/account`} />
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="site-foot-grid">
        <div>
          <Logo small />
          <p className="site-foot-blurb">Stacks and setup steps for what you&apos;re building, from published rules. No vendor pays for placement.</p>
        </div>
        <div>
          <h2>Get started</h2>
          <nav aria-label="Get started">
            <a href={`${SITE_URL}/start`}>Connect Cuely</a>
            <a href={`${APP_URL}/account`}>Get a key</a>
            <a href={`${SITE_URL}/pricing`}>Pricing</a>
          </nav>
        </div>
        <div>
          <h2>Catalog</h2>
          <nav aria-label="Catalog">
            <a href={`${SITE_URL}/tools`}>Tools</a>
            <a href={`${SITE_URL}/recipes`}>Recipes</a>
            <a href={`${SITE_URL}/#method`}>Method</a>
          </nav>
        </div>
        <div>
          <h2>Resources</h2>
          <nav aria-label="Resources">
            <a href={`${SITE_URL}/trust`}>What Cuely receives</a>
            <a href={`${SITE_URL}/llms.txt`}>llms.txt</a>
            <a href={`${SITE_URL}/privacy`}>Privacy</a>
            <a href={`${SITE_URL}/terms`}>Terms</a>
          </nav>
        </div>
        <div>
          <h2>Support</h2>
          <nav aria-label="Support">
            <a className="site-foot-addr" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </nav>
        </div>
      </div>
      <div className="site-foot-bottom">
        <span>© 2026 Cuely</span>
        <span className="site-foot-live">
          <i aria-hidden="true" />
          No vendor pays for placement
        </span>
      </div>
    </footer>
  );
}
