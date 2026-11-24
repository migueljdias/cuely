"use client";

import { useEffect, useState } from "react";

/*
  A slim bar above the header for one announcement at a time. It hides itself after END,
  and stays hidden for anyone who closes it (remembered in this browser only).
  To announce something new, change ID, END and the text.
*/

const ID = "open-source-2026-11";
const END = "2026-12-05T00:00:00Z";
const KEY = `cuely-announce-dismissed:${ID}`;

export function AnnounceBar({ trustHref, repoHref }: { trustHref: string; repoHref: string }) {
  const [show, setShow] = useState(() => Date.now() < Date.parse(END));

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) setShow(false);
    } catch {
      // Storage can be blocked; the bar just shows.
    }
  }, []);

  if (!show) return null;

  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Closing still works for this page view.
    }
  };

  return (
    <div className="announce" role="region" aria-label="Announcement">
      <p>
        <strong>Cuely is now open source.</strong>{" "}
        <a href={trustHref}>See exactly what it receives</a>
        <span className="announce-sep" aria-hidden="true">
          {" "}
          ·{" "}
        </span>
        <a href={repoHref} className="announce-repo">
          Code on GitHub
        </a>
      </p>
      <button type="button" className="announce-close" onClick={close} aria-label="Close announcement">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
