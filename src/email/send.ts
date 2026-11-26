/**
 * Sends email through Resend's HTTP API. Off unless RESEND_API_KEY and ALERTS_FROM are set
 * (ALERTS_FROM is a sender on a domain verified in Resend, e.g. "Cuely <alerts@cuely.dev>").
 */
export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}

export type SendEmail = (email: Email) => Promise<void>;

export function emailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_API_KEY && env.ALERTS_FROM);
}

export function resendSender(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): SendEmail {
  return async (email) => {
    if (!emailConfigured(env)) throw new Error("Email isn't configured.");
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.ALERTS_FROM, to: [email.to], subject: email.subject, text: email.text, html: email.html, headers: email.headers }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? `Resend returned ${res.status}`);
    }
  };
}
