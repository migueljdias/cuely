import type { ReactNode } from "react";
import { BadgeCheck, CalendarClock, KeyRound } from "lucide-react";
import { authConfigured } from "@/auth/server";
import { PLANS } from "@/plans";
import { SITE_URL } from "@/site";
import { DotField } from "./home/dot-field";

/*
  Sign-in and sign-up: a split screen with no site header. The left half holds the Cuely logo
  (back to cuely.dev), the heading and Clerk's form; the right half is the home page's blue
  panel with three true facts about Cuely where a template would put testimonials.
  Styles: the "Auth split" block in globals.css.
*/

const FACTS = [
  {
    icon: BadgeCheck,
    title: "No paid placement",
    text: "Picks come from published rules. No vendor pays to be recommended.",
  },
  {
    icon: CalendarClock,
    title: "Checked every day",
    text: "Prices, outages and advisories are measured daily and published automatically.",
  },
  {
    icon: KeyRound,
    title: "Free to start",
    text: `${PLANS.free.perDay.toLocaleString("en-US")} tool calls a day on the Free plan. Same answers as Pro.`,
  },
];

function Logo() {
  return (
    <a href={`${SITE_URL}/`} className="authx-logo" aria-label="Cuely home">
      <picture>
        <source srcSet="/brand/cuely-logo-dark.svg" media="(prefers-color-scheme: dark)" />
        <img src="/brand/cuely-logo-light.svg" alt="Cuely" width={89} height={28} />
      </picture>
    </a>
  );
}

export function AuthShell({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="authx">
      <section className="authx-side">
        <Logo />
        <main id="main" className="authx-main">
          <h1 className="authx-title rise">{title}</h1>
          <p className="authx-lede rise d1">{lede}</p>
          {authConfigured() ? (
            <div className="authx-clerk rise d2">{children}</div>
          ) : (
            <p className="notice" role="status">
              Accounts aren&apos;t switched on yet.
            </p>
          )}
        </main>
        <p className="authx-legal">
          By continuing you agree to the <a href={`${SITE_URL}/terms`}>Terms</a> and{" "}
          <a href={`${SITE_URL}/privacy`}>Privacy policy</a>.
        </p>
      </section>

      <aside className="authx-hero" aria-label="About Cuely">
        <div className="authx-panel">
          <DotField />
          <div className="authx-pitch">
            <p className="authx-eyebrow">
              <i aria-hidden="true" />
              For people building with AI
            </p>
            <p className="authx-big">Skip the research. Get to building.</p>
            <p className="authx-sub">
              Your coding agent asks Cuely which tools, security and setup steps fit what you&apos;re building.
            </p>
          </div>
          <ul className="authx-facts">
            {FACTS.map(({ icon: Icon, title: t, text }, i) => (
              <li key={t} className={`authx-fact pop d${i + 3}`}>
                <span className="authx-fact-icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span>
                  <strong>{t}</strong>
                  <span>{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
