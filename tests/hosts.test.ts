import { describe, expect, it } from "vitest";
import { routeByHost } from "@/hosts";

const app = (p: string, s = "") => routeByHost("app.cuely.dev", p, s);
const site = (p: string, s = "") => routeByHost("cuely.dev", p, s);

describe("routeByHost", () => {
  it("serves sign-in, sign-up and account on app.cuely.dev", () => {
    for (const p of ["/sign-in", "/sign-in/factor-one", "/sign-up", "/sign-up/verify-email-address", "/account"]) {
      expect(app(p)).toBeNull();
    }
  });

  it("sends the app root to the account page", () => {
    expect(app("/")).toEqual({ kind: "redirect", url: "https://app.cuely.dev/account", status: 307 });
  });

  it("sends public pages on the app host back to cuely.dev", () => {
    expect(app("/pricing", "?x=1")).toEqual({ kind: "redirect", url: "https://cuely.dev/pricing?x=1", status: 308 });
  });

  it("maps the old /auth paths on either host", () => {
    expect(app("/auth/sign-in")).toEqual({ kind: "redirect", url: "https://app.cuely.dev/sign-in", status: 308 });
    expect(site("/auth/sign-up/sso-callback", "?a=b")).toEqual({
      kind: "redirect",
      url: "https://app.cuely.dev/sign-up/sso-callback?a=b",
      status: 307,
    });
  });

  it("sends app pages on cuely.dev to app.cuely.dev, keeping the query", () => {
    expect(site("/account", "?checkout=done")).toEqual({
      kind: "redirect",
      url: "https://app.cuely.dev/account?checkout=done",
      status: 307,
    });
    expect(site("/sign-in")).toEqual({ kind: "redirect", url: "https://app.cuely.dev/sign-in", status: 307 });
  });

  it("leaves public pages on cuely.dev alone", () => {
    for (const p of ["/", "/pricing", "/privacy", "/robots.txt", "/sitemap.xml", "/accounting"]) expect(site(p)).toBeNull();
  });

  it("keeps app.cuely.dev out of search", () => {
    expect(app("/robots.txt")).toEqual({ kind: "text", body: "User-agent: *\nDisallow: /\n", status: 200 });
    expect(app("/sitemap.xml")?.kind).toBe("text");
  });

  it("ignores other hosts, such as previews and localhost", () => {
    expect(routeByHost("cuely-two.vercel.app", "/account", "")).toBeNull();
    expect(routeByHost("localhost:3000", "/sign-in", "")).toBeNull();
    expect(routeByHost("APP.CUELY.DEV:443", "/account", "")).toBeNull();
  });
});
