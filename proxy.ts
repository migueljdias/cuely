import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk reads the session on pages and account actions, and keeps /account behind sign-in.
 * The MCP endpoint, the Stripe webhook and static files never pass through it.
 * Without Clerk keys this does nothing, so the site still builds and serves.
 */
const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
const isAccount = createRouteMatcher(["/account(.*)"]);

export default configured
  ? clerkMiddleware(async (auth, req) => {
      if (isAccount(req)) await auth.protect({ unauthenticatedUrl: new URL("/auth/sign-in", req.url).toString() });
    })
  : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|api/mcp|api/stripe|llms\\.txt|.*\\.[a-zA-Z0-9]+$).*)"],
};
