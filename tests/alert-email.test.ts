import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { alertsFor, changeKey, renderAlertEmail, unsubscribeSignature, verifyUnsubscribe } from "@/accounts/alert-mail";
import { runAlertEmails } from "@/accounts/alert-run";
import { baselineFor, stackStore } from "@/accounts/stacks";
import { accountStore } from "@/accounts/store";
import { tools } from "@/catalog";
import type { Email } from "@/email/send";
import { emailConfigured, resendSender } from "@/email/send";

const schema = readFileSync(path.resolve(import.meta.dirname, "../db/schema.sql"), "utf8");
const tool = (slug: string) => tools.find((t) => t.slug === slug)!;

describe("Alert emails", () => {
  const db = new PGlite();
  const query = async (text: string, params?: unknown[]) => (await db.query(text, params)).rows as Record<string, any>[];
  const accounts = accountStore(query);
  const stacks = stackStore(query);
  const outbox: Email[] = [];
  const deps = (send = async (e: Email) => void outbox.push(e)) => ({
    accounts,
    stacks,
    tools,
    send,
    secret: "test-secret",
    appUrl: "https://app.example",
    siteUrl: "https://site.example",
  });

  beforeAll(async () => {
    await db.exec(schema);
    await accounts.ensure("user_on", "on@example.com");
    await accounts.ensure("user_off", "off@example.com");
    // Both projects use Vercel; the baseline says it used to offer a HIPAA BAA and cost less.
    const v = baselineFor([tool("vercel")]).vercel;
    const stale = { vercel: { ...v, paidStartsAt: "old price", compliance: { ...v.compliance, baa: "yes" as const } } };
    await stacks.create("user_on", { name: "Notes", description: "", tools: ["vercel"], baseline: stale });
    await stacks.create("user_off", { name: "Other", description: "", tools: ["vercel"], baseline: stale });
    await accounts.setAlertPrefs("user_on", { digest: true, blockers: false, prices: true });
  });

  it("emails only accounts that turned that email on, once per change", async () => {
    const first = await runAlertEmails("prices", deps());
    expect(first).toMatchObject({ sent: 1, failed: 0 });
    expect(outbox).toHaveLength(1);
    const mail = outbox[0];
    expect(mail.to).toBe("on@example.com");
    expect(mail.subject).toMatch(/price change/);
    expect(mail.text).toContain("Vercel");
    expect(mail.text).toContain("In: Notes");
    expect(mail.headers?.["List-Unsubscribe"]).toContain("https://site.example/api/alerts/unsubscribe?u=user_on&k=prices&s=");
    expect(mail.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    const again = await runAlertEmails("prices", deps());
    expect(again).toMatchObject({ sent: 0, skipped: 1 });
    expect(outbox).toHaveLength(1);
  });

  it("doesn't record a failed send, so the next run tries again", async () => {
    const failing = await runAlertEmails("digest", deps(async () => {
      throw new Error("resend down");
    }));
    expect(failing).toMatchObject({ sent: 0, failed: 1 });
    const retry = await runAlertEmails("digest", deps());
    expect(retry).toMatchObject({ sent: 1 });
    expect(outbox.at(-1)!.subject).toMatch(/^Cuely weekly/);
  });

  it("sends nothing for a kind nobody turned on", async () => {
    const before = outbox.length;
    expect(await runAlertEmails("blockers", deps())).toMatchObject({ sent: 0, skipped: 0 });
    expect(outbox).toHaveLength(before);
  });

  it("turns one kind off from a signed link, and refuses a forged one", async () => {
    const sig = unsubscribeSignature("test-secret", "user_on", "prices");
    expect(verifyUnsubscribe("test-secret", "user_on", "prices", sig)).toBe(true);
    expect(verifyUnsubscribe("test-secret", "user_off", "prices", sig)).toBe(false);
    expect(verifyUnsubscribe("test-secret", "user_on", "digest", sig)).toBe(false);
    expect(verifyUnsubscribe("other-secret", "user_on", "prices", sig)).toBe(false);
    await accounts.disableAlert("user_on", "prices");
    expect((await accounts.get("user_on"))!.alerts).toEqual({ digest: true, blockers: false, prices: false });
  });
});

describe("Alert email content", () => {
  const alert = (over: object) => ({
    key: "k", type: "price" as const, tone: "neutral" as const, kind: "Price", tool: "vercel", toolName: "Vercel",
    text: "Paid plans now start at <b>$20</b> (https://vercel.com/pricing).", projects: [{ id: 1, name: "A & B", seenAt: "" }],
    changeKind: "price" as const, source: "change" as const, ...over,
  });

  it("picks the alerts each email carries", () => {
    const list = [
      alert({}),
      alert({ type: "compliance", tone: "worse", kind: "Compliance", changeKind: "compliance", text: "HIPAA BAA: not offered." }),
      alert({ type: "compliance", tone: "better", kind: "Compliance", changeKind: "compliance", text: "now offered" }),
      alert({ source: "measured", type: "outages", tone: "worse" }),
    ];
    expect(alertsFor("blockers", list).map((a) => a.text)).toEqual(["HIPAA BAA: not offered."]);
    expect(alertsFor("prices", list)).toHaveLength(1);
    expect(alertsFor("digest", list)).toHaveLength(3);
    expect(changeKey(list[0])).toMatch(/^[0-9a-f]{32}$/);
    expect(changeKey(list[0])).not.toBe(changeKey(list[1]));
  });

  it("escapes HTML and drops bare source URLs", () => {
    const m = renderAlertEmail("prices", [alert({})], { alerts: "a", settings: "s", unsubscribe: "u" });
    expect(m.html).toContain("&lt;b&gt;$20&lt;/b&gt;");
    expect(m.html).toContain("A &amp; B");
    expect(m.text).not.toContain("https://vercel.com/pricing");
  });

  it("stays off without Resend settings", async () => {
    expect(emailConfigured({})).toBe(false);
    expect(emailConfigured({ RESEND_API_KEY: "re_x", ALERTS_FROM: "Cuely <a@cuely.dev>" })).toBe(true);
    await expect(resendSender({})({ to: "x", subject: "s", text: "t", html: "h" })).rejects.toThrow(/isn't configured/);
  });
});
