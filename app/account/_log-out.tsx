"use client";

import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { SITE_URL } from "@/site";

/** The sidebar's Log out item. Signs out of Clerk and goes back to cuely.dev. */
export function LogOutItem() {
  return (
    <SignOutButton redirectUrl={`${SITE_URL}/`}>
      <button type="button" title="Log out">
        <LogOut size={17} strokeWidth={1.8} aria-hidden="true" />
        <span>Log out</span>
      </button>
    </SignOutButton>
  );
}
