import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccountStore } from "@/accounts/store";
import { authConfigured, currentUser } from "@/auth/server";
import { planFor } from "@/plans";
import { CuelyUserProfile } from "../../../_components/clerk-forms";
import { LogOutItem } from "../../_log-out";
import { AppShell } from "../../_shell";

export const metadata: Metadata = { title: "Profile · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Change your picture, name, email addresses and password. Clerk's profile editor does the work. */
export default async function ProfilePage() {
  if (!authConfigured()) redirect("/sign-in");
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  const store = await getAccountStore();
  const account = store ? await store.ensure(user.id, user.email) : null;
  const plan = planFor(account?.plan);

  return (
    <AppShell
      email={user.email ?? ""}
      name={user.name}
      imageUrl={user.imageUrl}
      plan={plan.name}
      page="profile"
      logOut={<LogOutItem />}
    >
      <div className="account is-profile">
        <div className="app-section">
          <h1 className="app-title">Profile</h1>
          <p className="app-lede">Your picture, name, email addresses and password.</p>
        </div>
        <CuelyUserProfile />
      </div>
    </AppShell>
  );
}
