"use client";

import { useEffect, useState } from "react";

/**
 * Today's date or a time-of-day greeting, in the visitor's own time zone. The server doesn't
 * know it, so the first render says something neutral and the browser fills in the rest.
 */
export function Greeting({ part, name }: { part: "date" | "hello"; name?: string | null }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  if (part === "date") {
    return <>{now ? now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) : "Today"}</>;
  }
  const h = now?.getHours();
  const hello = h === undefined ? "Welcome back" : h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return <>{name ? `${hello}, ${name}` : hello}</>;
}
