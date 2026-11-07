import { APP_HOST, APP_URL, SITE_HOST, SITE_URL } from "./site";

/** Pages that live on app.cuely.dev. Everything else is the public site. */
const APP_PAGE = /^\/(sign-in|sign-up|account)(\/.*)?$/;

export type HostRoute =
  | { kind: "redirect"; url: string; status: 307 | 308 }
  | { kind: "text"; body: string; status: number }
  | null;

/** Old /auth/sign-in and /auth/sign-up paths, mapped to the new ones. */
function appPath(pathname: string): string | null {
  const old = pathname.match(/^\/auth\/(sign-in|sign-up)(\/.*)?$/);
  if (old) return `/${old[1]}${old[2] ?? ""}`;
  if (APP_PAGE.test(pathname)) return pathname;
  return null;
}

/**
 * Where a page request should go, given its host. null means serve it here.
 * Hosts other than the two production ones (previews, localhost) are left alone.
 */
export function routeByHost(host: string, pathname: string, search: string): HostRoute {
  const h = host.split(":")[0].toLowerCase();

  if (h === APP_HOST) {
    if (pathname === "/robots.txt") return { kind: "text", body: "User-agent: *\nDisallow: /\n", status: 200 };
    if (pathname === "/sitemap.xml") return { kind: "text", body: "Not found\n", status: 404 };
    if (pathname === "/") return { kind: "redirect", url: `${APP_URL}/account${search}`, status: 307 };
    const app = appPath(pathname);
    if (app === pathname) return null;
    if (app) return { kind: "redirect", url: `${APP_URL}${app}${search}`, status: 308 };
    return { kind: "redirect", url: `${SITE_URL}${pathname}${search}`, status: 308 };
  }

  if (h === SITE_HOST) {
    const app = appPath(pathname);
    if (app) return { kind: "redirect", url: `${APP_URL}${app}${search}`, status: 307 };
  }

  return null;
}
