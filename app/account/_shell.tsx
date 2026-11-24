"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  CreditCard,
  ExternalLink,
  Gauge,
  KeyRound,
  Layers,
  LayoutGrid,
  LifeBuoy,
  Menu,
  PanelLeft,
  Rocket,
  Settings,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { SITE_URL, SUPPORT_EMAIL } from "@/site";
import { Avatar } from "./_avatar";

/*
  The signed-in app: a left sidebar instead of the site's top bar. On wide screens the sidebar
  can shrink to an icon rail (remembered in this browser); under 900px it becomes a drawer
  opened from the top bar. Styles: the "App shell" block in globals.css.

  Every item is its own page under /account, so the layout (and this shell) stays mounted
  while the content changes. Old links to /account#keys and friends are sent to their page.
*/

type Item = { href: string; label: string; icon: typeof LayoutGrid };

const WORKSPACE: Item[] = [
  { href: "/account", label: "Overview", icon: LayoutGrid },
  { href: "/account/ask", label: "Ask Cuely", icon: Sparkles },
  { href: "/account/stacks", label: "My stacks", icon: Layers },
];

const ACCOUNT: Item[] = [
  { href: "/account/keys", label: "API keys", icon: KeyRound },
  { href: "/account/usage", label: "Usage", icon: Gauge },
  { href: "/account/billing", label: "Plan & billing", icon: CreditCard },
  { href: "/account/settings", label: "Settings", icon: Settings },
];

const PROFILE: Item = { href: "/account/profile", label: "Profile", icon: UserRound };

const BUILD = [
  { href: `${SITE_URL}/start`, label: "Get started", icon: Rocket },
  { href: `${SITE_URL}/recipes`, label: "Recipes", icon: BookOpen },
  { href: `${SITE_URL}/tools`, label: "Tools", icon: Wrench },
];

/** Where the anchors of the old single account page live now. */
const OLD_ANCHORS: Record<string, string> = {
  "#overview": "/account",
  "#plan": "/account/billing",
  "#usage": "/account/usage",
  "#keys": "/account/keys",
  "#email": "/account/settings",
};

const RAIL_KEY = "cuely-sidebar-rail";

function isActive(pathname: string, href: string) {
  return href === "/account" ? pathname === "/account" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  email,
  name,
  imageUrl,
  plan,
  logOut,
  children,
}: {
  email: string;
  name: string | null;
  /** The user's profile picture, or null to show their initial. */
  imageUrl: string | null;
  plan: string;
  /** The sign-out item, passed in so the shell itself doesn't need Clerk. */
  logOut: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/account";
  const router = useRouter();
  const [rail, setRail] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setRail(localStorage.getItem(RAIL_KEY) === "1");
    } catch {}
  }, []);

  // Bookmarks and emails from the one-page account point at anchors; open the page instead.
  useEffect(() => {
    if (pathname !== "/account") return;
    const to = OLD_ANCHORS[window.location.hash];
    if (to && to !== "/account") router.replace(`${to}${window.location.search}`);
  }, [pathname, router]);

  // Closes the drawer after navigating.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggleRail = () => {
    const next = !rail;
    setRail(next);
    try {
      localStorage.setItem(RAIL_KEY, next ? "1" : "0");
    } catch {}
  };

  const current = [...WORKSPACE, ...ACCOUNT, PROFILE].find((i) => isActive(pathname, i.href));
  const label = name || email;

  const navLink = ({ href, label, icon: Icon }: Item) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        className={active ? "is-active" : undefined}
        aria-current={active ? "page" : undefined}
        title={rail ? label : undefined}
      >
        <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className={`app${rail ? " is-rail" : ""}${open ? " is-open" : ""}`}>
      <a className="skip" href="#main">
        Skip to content
      </a>

      <aside className="app-side" aria-label="Account navigation">
        <div className="app-side-top">
          <a href={`${SITE_URL}/`} className="app-logo" aria-label="Cuely home">
            <picture className="app-logo-full">
              <source srcSet="/brand/cuely-logo-dark.svg" media="(prefers-color-scheme: dark)" />
              <img src="/brand/cuely-logo-light.svg" alt="Cuely" width={76} height={24} />
            </picture>
            <img className="app-logo-mark" src="/brand/cuely-icon-light.svg" alt="" width={24} height={24} />
          </a>
          <button type="button" className="app-icon-btn app-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <Link href={PROFILE.href} className="app-who" title={rail ? "Your profile" : undefined}>
          <Avatar className="app-avatar" imageUrl={imageUrl} label={label} />
          <span className="app-who-text">
            <span className="app-who-email">{email}</span>
            <span className="app-who-plan">{plan} plan</span>
          </span>
        </Link>

        <nav className="app-nav" aria-label="Workspace">
          {WORKSPACE.map(navLink)}
        </nav>

        <p className="app-nav-head">Account</p>
        <nav className="app-nav" aria-label="Account">
          {ACCOUNT.map(navLink)}
        </nav>

        <p className="app-nav-head">Build</p>
        <nav className="app-nav" aria-label="Build">
          {BUILD.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} title={rail ? label : undefined}>
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
              <ExternalLink className="app-ext" size={13} aria-hidden="true" />
            </a>
          ))}
        </nav>

        <div className="app-side-foot">
          <nav className="app-nav" aria-label="Help">
            {navLink(PROFILE)}
            <a href={`mailto:${SUPPORT_EMAIL}`} title={rail ? "Support" : undefined}>
              <LifeBuoy size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>Support</span>
            </a>
            {logOut}
          </nav>
        </div>
      </aside>

      <button type="button" className="app-scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} />

      <div className="app-body">
        <header className="app-top">
          <button type="button" className="app-icon-btn app-menu" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <button
            type="button"
            className="app-icon-btn app-rail-btn"
            onClick={toggleRail}
            aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={rail}
          >
            <PanelLeft size={18} strokeWidth={1.8} />
          </button>
          <nav className="app-crumbs" aria-label="Breadcrumb">
            <Link href="/account">Account</Link>
            {current && current.href !== "/account" && (
              <>
                <span aria-hidden="true">/</span>
                <strong>{current.label}</strong>
              </>
            )}
          </nav>
          <Link className="app-top-avatar" href={PROFILE.href} aria-label="Your profile" title="Your profile">
            <Avatar imageUrl={imageUrl} label={label} />
          </Link>
        </header>
        <main id="main" className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}
