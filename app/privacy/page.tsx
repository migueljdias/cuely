import type { Metadata } from "next";
import { OPERATOR, REPO_URL, SUPPORT_EMAIL } from "@/site";
import { LegalPage } from "../_components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy · Cuely",
  description: "What Cuely collects, why, who handles it, and how to get it deleted.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      lede="Cuely collects as little as it can. It doesn't sell data, show ads, or let anyone pay to be recommended."
    >
      <h2>Who runs Cuely</h2>
      <p>
        Cuely (cuely.dev) is run by {OPERATOR}, an individual based in Texas, USA. Questions about this policy or your data go
        to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>Browsing the website</h2>
      <p>
        You can read cuely.dev without an account. The site doesn&apos;t use advertising or tracking cookies. Vercel Web Analytics counts page views and Vercel Speed Insights measures page load times. Both are cookieless, report only totals, and don&apos;t identify you or follow you to other sites.
      </p>

      <h2>Using the MCP server</h2>
      <p>
        The MCP server needs a free account. Your agent sends a plain description of the product and the names of the
        tools it uses; Cuely never receives your code, files or secrets (<a href="/trust">what Cuely receives</a> shows a
        real example). For each call Cuely records which tool was used and which categories, needs or recipe the answer
        covered, so it can see what builders need. It does not store the description or tool list your agent sends, and
        it does not store your IP address. It counts your account&apos;s calls per day and per minute to apply your
        plan&apos;s limits, and keeps those daily counts so you can see your usage. Requests without a valid key or
        sign-in are limited by IP address, in memory only.
      </p>

      <h2>If you create an account</h2>
      <ul>
        <li>
          <strong>Sign-in:</strong> Clerk runs sign-up and sign-in. Cuely receives your email address, your name if you
          give one, and a Clerk user ID. If you sign in with Google or another provider, that provider shares your email and
          basic profile with Clerk, and Cuely asks for nothing more.
        </li>
        <li>
          <strong>Account record:</strong> Cuely stores your user ID, email, plan, and, if you subscribe, your Stripe customer
          and subscription IDs and renewal date.
        </li>
        <li>
          <strong>API keys:</strong> Cuely stores only a hash of each key, its name, its first few characters and when it was
          last used. The full key is shown to you once and never stored.
        </li>
        <li>
          <strong>Connector sign-in:</strong> when you connect Cuely in Claude or another AI tool, Clerk signs you in and
          gives that tool an access token for Cuely. Cuely checks the token on each call and doesn&apos;t store it.
        </li>
      </ul>

      <h2>Payments</h2>
      <p>
        Stripe processes payments for Pro as the merchant of record, which means Stripe sells the subscription to you and
        handles tax, receipts and card data. Cuely never sees or stores your card number. Stripe&apos;s own privacy policy
        covers what Stripe collects.
      </p>

      <h2>Who handles your data</h2>
      <ul>
        <li>
          <strong>Vercel</strong> hosts the site and the MCP server, runs its firewall, and provides the page view and speed counts.
        </li>
        <li>
          <strong>Neon</strong> hosts the Postgres database that holds the records above.
        </li>
        <li>
          <strong>Clerk</strong> handles accounts and sign-in.
        </li>
        <li>
          <strong>Stripe</strong> handles payments.
        </li>
        <li>
          <strong>Resend</strong> sends account and billing email, if Cuely sends you any.
        </li>
      </ul>
      <p>These services process data only to run Cuely. Cuely doesn&apos;t sell or rent your data to anyone.</p>

      <h2>Checking these claims</h2>
      <p>
        The code that runs Cuely is public at <a href={REPO_URL}>{REPO_URL}</a>, including the database schema and the
        code that writes each usage record, so you can check this policy against what the server does.
      </p>

      <h2>Cookies</h2>
      <p>
        Cuely uses only the cookies needed to keep you signed in. There are no advertising or cross-site tracking cookies.
      </p>

      <h2>Keeping and deleting data</h2>
      <p>
        Your account data is kept while your account is open. Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to see, correct or delete it, and it will be removed within
        30 days, except records the law requires to be kept, such as payment records held by Stripe. Anonymous usage counts
        are kept to improve the catalog and can&apos;t be linked back to you.
      </p>

      <h2>Children</h2>
      <p>Cuely is for builders and isn&apos;t meant for anyone under 13.</p>

      <h2>Changes</h2>
      <p>
        If this policy changes, the new version goes on this page with a new date. Big changes will also be emailed to
        account holders.
      </p>
    </LegalPage>
  );
}
