import type { Tool } from "@/catalog";
import { alertsFor, changeKey, renderAlertEmail, unsubscribeSignature } from "./alert-mail";
import { buildAlerts } from "./alerts";
import { stackChanges, type StackStore } from "./stacks";
import type { AccountStore, AlertKind } from "./store";
import type { SendEmail } from "@/email/send";

export interface AlertRunDeps {
  accounts: Pick<AccountStore, "alertRecipients" | "sentAlertKeys" | "recordAlertsSent">;
  stacks: Pick<StackStore, "list">;
  tools: Tool[];
  send: SendEmail;
  /** Signs unsubscribe links. */
  secret: string;
  appUrl: string;
  siteUrl: string;
}

/**
 * Emails each account that turned this kind on, with the alerts it hasn't been sent yet.
 * An account with nothing new gets no email. A failed send isn't recorded, so the next run
 * tries again.
 */
export async function runAlertEmails(kind: AlertKind, deps: AlertRunDeps) {
  const bySlug = new Map(deps.tools.map((t) => [t.slug, t]));
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const r of await deps.accounts.alertRecipients(kind)) {
    const projects = (await deps.stacks.list(r.userId)).map((stack) => {
      const tools = stack.tools.map((t) => bySlug.get(t)).filter((t) => t !== undefined);
      return { stack, tools, changes: stackChanges(stack.baseline, tools) };
    });
    const already = await deps.accounts.sentAlertKeys(r.userId, kind);
    const fresh = alertsFor(kind, buildAlerts(projects)).filter((a) => !already.has(changeKey(a)));
    if (!fresh.length) {
      skipped++;
      continue;
    }
    const sig = unsubscribeSignature(deps.secret, r.userId, kind);
    const unsubscribe = `${deps.siteUrl}/api/alerts/unsubscribe?u=${encodeURIComponent(r.userId)}&k=${kind}&s=${sig}`;
    const mail = renderAlertEmail(kind, fresh, { alerts: `${deps.appUrl}/account/alerts`, settings: `${deps.appUrl}/account/alerts#h-deliver`, unsubscribe });
    try {
      await deps.send({
        to: r.email,
        ...mail,
        headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      await deps.accounts.recordAlertsSent(r.userId, kind, fresh.map(changeKey));
      sent++;
    } catch (err) {
      failed++;
      console.error(JSON.stringify({ event: "alert_email_failed", kind, reason: err instanceof Error ? err.message : String(err) }));
    }
  }
  return { kind, sent, skipped, failed };
}
