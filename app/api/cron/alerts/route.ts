import { runAlertEmails } from "@/accounts/alert-run";
import { getStackStore } from "@/accounts/stacks";
import { getAccountStore } from "@/accounts/store";
import { emailConfigured, resendSender } from "@/email/send";
import { getRepository } from "@/repo";
import { APP_URL, SITE_URL } from "@/site";

export const dynamic = "force-dynamic";

/**
 * Sends alert emails. Vercel Cron calls it (vercel.json) with "Authorization: Bearer CRON_SECRET":
 * ?run=daily sends launch blockers and price changes, ?run=weekly sends the Monday digest.
 * Does nothing until CRON_SECRET, RESEND_API_KEY and ALERTS_FROM are set.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  if (!emailConfigured()) return Response.json({ skipped: "email not configured" });
  const [accounts, stacks] = await Promise.all([getAccountStore(), getStackStore()]);
  if (!accounts || !stacks) return Response.json({ skipped: "no database" });

  const run = new URL(req.url).searchParams.get("run");
  const kinds = run === "weekly" ? (["digest"] as const) : run === "daily" ? (["blockers", "prices"] as const) : null;
  if (!kinds) return new Response("Pass ?run=daily or ?run=weekly", { status: 400 });

  const tools = (await (await getRepository()).snapshot()).tools;
  const deps = { accounts, stacks, tools, send: resendSender(), secret: process.env.ALERTS_SIGNING_SECRET ?? secret, appUrl: APP_URL, siteUrl: SITE_URL };
  const results = [];
  for (const kind of kinds) results.push(await runAlertEmails(kind, deps));
  console.log(JSON.stringify({ event: "alert_emails", results }));
  return Response.json({ results });
}
