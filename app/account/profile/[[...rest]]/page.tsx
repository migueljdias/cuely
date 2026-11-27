import type { Metadata } from "next";
import { CuelyUserProfile } from "../../../_components/clerk-forms";
import { accountSession } from "../../_session";

export const metadata: Metadata = { title: "Profile · Cuely", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Change your picture, name, email addresses and password. Clerk's profile editor does the work. */
export default async function ProfilePage() {
  await accountSession();
  return (
    <div className="account is-profile">
      <div className="app-section">
        <h1 className="app-title">Profile</h1>
        <p className="app-lede">Your picture, name, email addresses and password.</p>
      </div>
      <CuelyUserProfile />
    </div>
  );
}
