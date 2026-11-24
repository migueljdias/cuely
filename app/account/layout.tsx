import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LogOutItem } from "./_log-out";
import { accountSession } from "./_session";
import { AppShell } from "./_shell";

export const metadata: Metadata = { title: "Account · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The signed-in app: one shell around every /account page, so moving between them keeps the sidebar. */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const { user, plan } = await accountSession();
  return (
    <AppShell email={user.email ?? ""} name={user.name} imageUrl={user.imageUrl} plan={plan.name} logOut={<LogOutItem />}>
      {children}
    </AppShell>
  );
}
