import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, getAuth } from "@/auth/server";

/** Keeps the account page behind sign-in and refreshes the session cookie when needed. */
let guard: ((req: NextRequest) => Promise<NextResponse>) | null = null;

export default function proxy(req: NextRequest) {
  if (!authConfigured()) return NextResponse.next();
  guard ??= getAuth().middleware({ loginUrl: "/auth/sign-in" });
  return guard(req);
}

export const config = {
  matcher: ["/account/:path*"],
};
