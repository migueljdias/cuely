import { verifyUnsubscribe } from "@/accounts/alert-mail";
import { ALERT_KINDS, getAccountStore, type AlertKind } from "@/accounts/store";
import { APP_URL } from "@/site";

export const dynamic = "force-dynamic";

const NAMES: Record<AlertKind, string> = { digest: "the weekly digest", blockers: "launch blocker alerts", prices: "price change alerts" };

/** Checks the signed link and turns that one alert email off. */
async function unsubscribe(url: URL): Promise<{ ok: boolean; kind?: AlertKind }> {
  const userId = url.searchParams.get("u") ?? "";
  const kind = url.searchParams.get("k") as AlertKind;
  const sig = url.searchParams.get("s") ?? "";
  const secret = process.env.ALERTS_SIGNING_SECRET ?? process.env.CRON_SECRET;
  if (!secret || !userId || !ALERT_KINDS.includes(kind) || !verifyUnsubscribe(secret, userId, kind, sig)) return { ok: false };
  const store = await getAccountStore();
  if (!store) return { ok: false };
  await store.disableAlert(userId, kind);
  return { ok: true, kind };
}

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Cuely</title></head>
<body style="margin:0;padding:48px 16px;background:#0b1020;color:#eef1f8;font-family:-apple-system,Segoe UI,sans-serif">
<div style="max-width:480px;margin:0 auto"><p style="font-size:22px;font-weight:600;color:#9db2ff;margin:0 0 24px">cuely</p><h1 style="font-size:26px;font-weight:500;margin:0 0 8px">${title}</h1><p style="color:#c9d0e0">${body}</p></div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

/**
 * Unsubscribes: the one-click request from the email client (RFC 8058), or the button on the
 * page below. A plain GET never unsubscribes, since mail scanners open every link.
 */
export async function POST(req: Request) {
  const r = await unsubscribe(new URL(req.url));
  if (!r.ok) return page("That link didn't work", `Turn alert emails off on your <a style="color:#9db2ff" href="${APP_URL}/account/alerts">Alerts page</a> instead.`, 400);
  return page("You're unsubscribed", `You won't get ${NAMES[r.kind!]} any more. Turn it back on any time on your <a style="color:#9db2ff" href="${APP_URL}/account/alerts">Alerts page</a>.`);
}

/** The link in the email footer: a page with one button. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("k") as AlertKind;
  if (!ALERT_KINDS.includes(kind)) return page("That link didn't work", `Turn alert emails off on your <a style="color:#9db2ff" href="${APP_URL}/account/alerts">Alerts page</a> instead.`, 400);
  const action = `${url.pathname}${url.search}`.replace(/"/g, "&quot;");
  return page(
    "Stop these emails?",
    `This turns off ${NAMES[kind]} for your Cuely account.</p><form method="post" action="${action}"><button type="submit" style="min-height:44px;padding:0 20px;border:0;border-radius:10px;background:#2f5bff;color:#fff;font:500 15px -apple-system,Segoe UI,sans-serif;cursor:pointer">Unsubscribe</button></form><p style="color:#9aa3bc">`,
  );
}
