import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Alert } from "./alerts";
import type { AlertKind } from "./store";
import { html } from "@/html";

/**
 * Alert emails: which alerts go in each kind of email, how a change is remembered as sent,
 * the email itself, and signed one-click unsubscribe links.
 */

/** The alerts each kind of email carries. Only changes since last seen; measured problems stay on the page. */
export function alertsFor(kind: AlertKind, alerts: Alert[]): Alert[] {
  const changes = alerts.filter((a) => a.source === "change");
  if (kind === "blockers") return changes.filter((a) => a.type === "compliance" && a.tone === "worse");
  if (kind === "prices") return changes.filter((a) => a.type === "price");
  return changes;
}

/** A short, stable key for a change, so it's emailed once per kind. Names the change, nothing the holder typed. */
export function changeKey(a: Alert): string {
  return createHash("sha256").update(`${a.tool}|${a.changeKind ?? a.kind}|${a.text}`).digest("hex").slice(0, 32);
}

const SUBJECT: Record<AlertKind, (n: number) => string> = {
  digest: (n) => `Cuely weekly: ${n} change${n === 1 ? "" : "s"} in your projects`,
  blockers: (n) => (n === 1 ? "Cuely: a compliance change may block your launch" : `Cuely: ${n} compliance changes may block your launch`),
  prices: (n) => `Cuely: ${n} price change${n === 1 ? "" : "s"} for tools you use`,
};

const INTRO: Record<AlertKind, string> = {
  digest: "Here's what changed this week for the tools in your projects.",
  blockers: "A tool in your projects changed a compliance answer for the worse. Check it before real data goes in.",
  prices: "A tool in your projects changed its price or free plan.",
};

const plain = (s: string) => s.replace(/\s*\(https?:\/\/[^)\s]+\)/g, "");

export function renderAlertEmail(kind: AlertKind, alerts: Alert[], links: { alerts: string; settings: string; unsubscribe: string }) {
  const subject = SUBJECT[kind](alerts.length);
  const lines = alerts.map((a) => ({ head: `${a.kind} · ${a.toolName}`, body: plain(a.text), where: a.projects.map((p) => p.name).join(", ") }));
  const text = [
    INTRO[kind],
    "",
    ...lines.flatMap((l) => [`${l.head}`, `${l.body}`, `In: ${l.where}`, ""]),
    `See every alert: ${links.alerts}`,
    "",
    `You get this because you turned it on. Change it: ${links.settings}`,
    `Stop these emails: ${links.unsubscribe}`,
  ].join("\n");
  const body = html`<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,Segoe UI,sans-serif;color:#14161c">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e1e5ef;border-radius:16px;padding:24px">
<p style="margin:0 0 16px;font-size:20px;font-weight:600;color:#1f4bd8">cuely</p>
<p style="margin:0 0 16px;font-size:16px">${INTRO[kind]}</p>
${lines.map(
  (l) => html`<div style="padding:14px 0;border-top:1px solid #e1e5ef">
<p style="margin:0;font:500 12px ui-monospace,monospace;text-transform:uppercase;color:#8f4300">${l.head}</p>
<p style="margin:4px 0 0;font-size:15px">${l.body}</p>
<p style="margin:4px 0 0;font-size:13px;color:#5f6678">In: ${l.where}</p></div>`,
)}
<p style="margin:20px 0 0"><a href="${links.alerts}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#1f4bd8;color:#fff;text-decoration:none;font-weight:500">See every alert</a></p>
</div>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#5f6678">You get this because you turned it on in Cuely. <a href="${links.settings}" style="color:#1a3fb8">Change your alert emails</a> or <a href="${links.unsubscribe}" style="color:#1a3fb8">stop these emails</a>.</p>
</body></html>`;
  return { subject, text, html: body.value };
}

/** HMAC of the account and kind, so an unsubscribe link only turns off that one email for that one account. */
export function unsubscribeSignature(secret: string, userId: string, kind: AlertKind): string {
  return createHmac("sha256", secret).update(`unsubscribe:${userId}:${kind}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribe(secret: string, userId: string, kind: AlertKind, sig: string): boolean {
  const want = Buffer.from(unsubscribeSignature(secret, userId, kind));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
