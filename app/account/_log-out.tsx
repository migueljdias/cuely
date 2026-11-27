"use client";

import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { SITE_URL } from "@/site";

/** The sidebar's Log out item. Signs out of Clerk and goes back to cuely.dev. */
export function LogOutItem() {
  return (
    <SignOutButton redirectUrl={`${SITE_URL}/`}>
      <button type="button" title="Log out">
        <LogOut size={19} strokeWidth={1.9} aria-hidden="true" />
        <span className="app-nav-label">Log out</span>
      </button>
    </SignOutButton>
  );
}
