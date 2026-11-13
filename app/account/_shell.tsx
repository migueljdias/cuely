"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  CreditCard,
  ExternalLink,
  Gauge,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  Menu,
  PanelLeft,
  Rocket,
  Wrench,
  X,
} from "lucide-react";
import { SITE_URL, SUPPORT_EMAIL } from "@/site";
import { Avatar } from "./_avatar";

/*
  The signed-in app: a left sidebar instead of the site's top bar. On wide screens the sidebar
  can shrink to an icon rail (remembered in this browser); under 900px it becomes a drawer
  opened from the top bar. Styles: the "App shell" block in globals.css.

  The account sections are anchors on /account; Profile is its own page (/account/profile),
  reached from the sidebar item above Support or the avatar in the top bar.
*/

const ACCOUNT = [
  { href: "#overview", label: "Overview", icon: LayoutGrid },
  { href: "#plan", label: "Plan & billing", icon: CreditCard },
  { href: "#usage", label: "Usage", icon: Gauge },
  { href: "#keys", label: "API keys", icon: KeyRound },
];

const PROFILE_HREF = "/account/profile";

const BUILD = [
  { href: `${SITE_URL}/start`, label: "Get started", icon: Rocket },
  { href: `${SITE_URL}/recipes`, label: "Recipes", icon: BookOpen },
  { href: `${SITE_URL}/tools`, label: "Tools", icon: Wrench },
];

const RAIL_KEY = "cuely-sidebar-rail";

export function AppShell({
  email,
  name,
  imageUrl,
  plan,
  page = "account",
  logOut,
  children,
}: {
  email: string;
  name: string | null;
  /** The user's profile picture, or null to show their initial. */
  imageUrl: string | null;
  plan: string;
  /** Which page is showing: the account sections, or the profile editor. */
  page?: "account" | "profile";
  /** The sign-out item, passed in so the shell itself doesn't need Clerk. */
  logOut: ReactNode;
  children: ReactNode;
}) {
  const [rail, setRail] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("#overview");

  useEffect(() => {
    try {
      setRail(localStorage.getItem(RAIL_KEY) === "1");
    } catch {}
  }, []);

  // Highlights the section nearest the top of the window as the page scrolls.
  useEffect(() => {
    if (page !== "account") return;
    const ids = ACCOUNT.map((a) => a.href.slice(1));
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e));
    const onScroll = () => {
      let cur = els[0]?.id;
      for (const el of els) if (el.getBoundingClientRect().top < 140) cur = el.id;
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) cur = els[els.length - 1]?.id;
      if (cur) setActive(`#${cur}`);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [page]);

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

  const onProfile = page === "profile";
  const current = onProfile ? "Profile" : (ACCOUNT.find((a) => a.href === active)?.label ?? "Overview");
  const label = name || email;

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

        <div className="app-who">
          <Avatar className="app-avatar" imageUrl={imageUrl} label={label} />
          <span className="app-who-text">
            <span className="app-who-email">{email}</span>
            <span className="app-who-plan">{plan} plan</span>
          </span>
        </div>

        <nav className="app-nav" aria-label="Account">
          {ACCOUNT.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={onProfile ? `/account${href}` : href}
              className={!onProfile && active === href ? "is-active" : undefined}
              aria-current={!onProfile && active === href ? "location" : undefined}
              onClick={() => setOpen(false)}
              title={rail ? label : undefined}
            >
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
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
            <a
              href={PROFILE_HREF}
              className={onProfile ? "is-active" : undefined}
              aria-current={onProfile ? "page" : undefined}
              title={rail ? "Profile" : undefined}
            >
              <Avatar className="app-nav-avatar" imageUrl={imageUrl} label={label} />
              <span>Profile</span>
            </a>
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
            <span>Account</span>
            <span aria-hidden="true">/</span>
            <strong>{current}</strong>
          </nav>
          <a className="app-top-avatar" href={PROFILE_HREF} aria-label="Your profile" title="Your profile">
            <Avatar imageUrl={imageUrl} label={label} />
          </a>
        </header>
        <main id="main" className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}
