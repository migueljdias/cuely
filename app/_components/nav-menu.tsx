"use client";

import { useEffect, useState } from "react";

/**
 * The menu button narrow screens get in place of the header links, and the panel it opens.
 * It also gives the header its shadow once the page has scrolled.
 */
export function NavMenu({ links, signInHref }: { links: { href: string; label: string }[]; signInHref: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const header = document.getElementById("site-nav");
    const onScroll = () => header?.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="menu-btn" aria-expanded={open} aria-controls="site-menu" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
        <i />
        <i />
      </button>
      <div className={`site-menu${open ? " open" : ""}`} id="site-menu" inert={!open}>
        <div>
          <nav aria-label="Menu" onClick={() => setOpen(false)}>
            {links.map((l, i) => (
              <a key={l.label} href={l.href} style={{ ["--i" as string]: i }}>
                {l.label}
              </a>
            ))}
            <a href={signInHref} style={{ ["--i" as string]: links.length }}>
              Account
            </a>
          </nav>
        </div>
      </div>
    </>
  );
}
