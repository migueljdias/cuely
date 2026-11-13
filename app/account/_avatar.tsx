"use client";

import { useUser } from "@clerk/nextjs";

/**
 * The signed-in user's picture, or the first letter of their name or email when they have none.
 * Starts from what the server rendered, then follows Clerk's live user, so a picture changed on
 * the profile page shows in the sidebar and top bar straight away, without a reload.
 */
export function Avatar({ imageUrl, label, className }: { imageUrl: string | null; label: string; className?: string }) {
  const { isLoaded, user } = useUser();
  const src = isLoaded && user ? (user.hasImage ? user.imageUrl : null) : imageUrl;
  const name = isLoaded && user ? user.fullName || user.primaryEmailAddress?.emailAddress || label : label;
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span className={`avatar${className ? ` ${className}` : ""}`} aria-hidden="true">
      {src ? <img src={src} alt="" width={30} height={30} referrerPolicy="no-referrer" /> : initial}
    </span>
  );
}
