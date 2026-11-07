import { createNeonAuth } from "@neon/auth/next/server";

type NeonAuth = ReturnType<typeof createNeonAuth>;
let instance: NeonAuth | null = null;

/** True when Neon Auth is configured (production). Local runs and tests work without it. */
export function authConfigured(): boolean {
  return Boolean(process.env.NEON_AUTH_BASE_URL && (process.env.NEON_AUTH_COOKIE_SECRET ?? "").length >= 32);
}

/** The Neon Auth server instance, created on first use so builds don't need the secrets. */
export function getAuth(): NeonAuth {
  if (!authConfigured()) throw new Error("Neon Auth is not configured.");
  instance ??= createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
    logLevel: "warn",
  });
  return instance;
}

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
}

/** The signed-in user, or null. Never throws. */
export async function currentUser(): Promise<SessionUser | null> {
  if (!authConfigured()) return null;
  try {
    const { data } = await getAuth().getSession();
    const u = data?.user as { id?: string; email?: string; name?: string } | undefined;
    return u?.id ? { id: u.id, email: u.email ?? null, name: u.name ?? null } : null;
  } catch (err) {
    console.warn("[auth] getSession failed", err);
    return null;
  }
}
