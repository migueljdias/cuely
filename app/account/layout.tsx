import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LogOutItem } from "./_log-out";
import { accountSession, projectsOverview } from "./_session";
import { AppShell } from "./_shell";

export const metadata: Metadata = { title: "Account · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The signed-in app: one shell around every /account page, so moving between them keeps the sidebar. */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const [{ user, plan }, { projects, alertCount }] = await Promise.all([accountSession(), projectsOverview()]);
  return (
    <AppShell
      email={user.email ?? ""}
      name={user.name}
      imageUrl={user.imageUrl}
      plan={plan.name}
      counts={{ projects: projects.length, alerts: alertCount }}
      logOut={<LogOutItem />}
    >
      {children}
    </AppShell>
  );
}
