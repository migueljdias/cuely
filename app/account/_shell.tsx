"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  CreditCard,
  Gauge,
  House,
  KeyRound,
  Layers,
  LifeBuoy,
  Menu,
  MessageCircle,
  PanelLeft,
  Rocket,
  Settings,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { SITE_URL, SUPPORT_EMAIL } from "@/site";
import { Avatar } from "./_avatar";

/*
  The signed-in app: a left sidebar instead of the site's top bar. On wide screens the sidebar
  can shrink to a 72px icon rail (remembered in this browser); under 900px it becomes a drawer
  opened from the top bar. Styles: the "App shell" block in globals.css, which also holds the
  app's colour tokens (dark by default, light when [data-theme="light"], or the system's). The
  theme comes from the account, so the first paint is already right.

  Every item is its own page under /account, so the layout (and this shell) stays mounted
  while the content changes. Old links to /account#keys and friends are sent to their page.
*/

type Item = { href: string; label: string; icon: typeof House; badge?: "projects" | "alerts" };

const WORKSPACE: Item[] = [
  { href: "/account", label: "Home", icon: House },
  { href: "/account/projects", label: "Projects", icon: Layers, badge: "projects" },
  { href: "/account/alerts", label: "Alerts", icon: Bell, badge: "alerts" },
  { href: "/account/ask", label: "Ask Cuely", icon: MessageCircle },
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
  counts,
  theme,
  logOut,
  children,
}: {
  email: string;
  name: string | null;
  /** The user's profile picture, or null to show their initial. */
  imageUrl: string | null;
  plan: string;
  /** Saved projects, and the changes across them since they were last looked at. */
  counts: { projects: number; alerts: number };
  /** Saved on the account and chosen on Settings: "dark", "light" or "system". */
  theme: string;
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

  const navLink = ({ href, label, icon: Icon, badge }: Item) => {
    const active = isActive(pathname, href);
    const count = badge ? counts[badge] : 0;
    return (
      <Link
        key={href}
        href={href}
        className={active ? "is-active" : undefined}
        aria-current={active ? "page" : undefined}
        title={rail ? label : undefined}
      >
        <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
        <span className="app-nav-label">{label}</span>
        {count > 0 && (
          <span className={`app-count${badge === "alerts" ? " is-warn" : ""}`}>
            {count}
            <span className="sr-only">{badge === "alerts" ? " alerts" : " projects"}</span>
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className={`app${rail ? " is-rail" : ""}${open ? " is-open" : ""}`} data-theme={theme}>
      <a className="skip" href="#main">
        Skip to content
      </a>

      <aside className="app-side" aria-label="Account navigation">
        <div className="app-side-top">
          <a href={`${SITE_URL}/`} className="app-logo" aria-label="Cuely home">
            <svg width="28" height="28" viewBox="0 0 224 224" aria-hidden="true">
              <rect width="224" height="224" rx="56" fill="#2f5bff" />
              <path d="M40 150a72 72 0 0 1 144 0z" fill="#c7d3ff" />
            </svg>
            <span className="app-logo-word">cuely</span>
          </a>
          <button
            type="button"
            className="app-icon-btn app-rail-btn"
            onClick={toggleRail}
            aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={rail}
          >
            <PanelLeft size={18} strokeWidth={2} />
          </button>
          <button type="button" className="app-icon-btn app-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <Link href={PROFILE.href} className="app-who" title={rail ? "Your profile" : undefined}>
          <Avatar className="app-avatar" imageUrl={imageUrl} label={label} />
          <span className="app-who-text">
            <span className="app-who-name">{label}</span>
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
              <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
              <span className="app-nav-label">{label}</span>
              <span className="app-ext" aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </nav>

        <div className="app-side-foot">
          <nav className="app-nav" aria-label="Help">
            {navLink(PROFILE)}
            <a href={`mailto:${SUPPORT_EMAIL}`} title={rail ? "Support" : undefined}>
              <LifeBuoy size={19} strokeWidth={1.9} aria-hidden="true" />
              <span className="app-nav-label">Support</span>
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
          <nav className="app-crumbs" aria-label="Breadcrumb">
            {current && current.href !== "/account" ? (
              <>
                <Link href="/account">Home</Link>
                <span aria-hidden="true">/</span>
                {pathname === current.href ? <strong>{current.label}</strong> : <Link href={current.href}>{current.label}</Link>}
              </>
            ) : (
              <strong>Home</strong>
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
