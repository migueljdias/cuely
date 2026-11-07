import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { routeByHost } from "@/hosts";

/**
 * First sends each page to its host: sign-in, sign-up and account live on app.cuely.dev,
 * everything else on cuely.dev (see src/hosts.ts). Then Clerk reads the session and keeps
 * /account behind sign-in. The MCP endpoint, the Stripe webhook and static files never pass
 * through here. Without Clerk keys the Clerk part does nothing, so the site still builds.
 */
const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
const isAccount = createRouteMatcher(["/account(.*)"]);

const clerk = configured
  ? clerkMiddleware(async (auth, req) => {
      if (isAccount(req)) await auth.protect({ unauthenticatedUrl: new URL("/sign-in", req.url).toString() });
    })
  : null;

export default function proxy(req: NextRequest, ev: NextFetchEvent) {
  const { pathname, search } = req.nextUrl;
  const route = routeByHost(req.headers.get("host") ?? "", pathname, search);
  if (route?.kind === "redirect") return NextResponse.redirect(route.url, route.status);
  if (route?.kind === "text") {
    return new NextResponse(route.body, { status: route.status, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  // robots.txt and sitemap.xml only come here for the host check.
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") return NextResponse.next();
  return clerk ? clerk(req, ev) : NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api/mcp|api/stripe|llms\\.txt|.*\\.[a-zA-Z0-9]+$).*)", "/robots.txt", "/sitemap.xml"],
};
