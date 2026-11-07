import type { Metadata } from "next";
import { OPERATOR, SUPPORT_EMAIL } from "@/site";
import { PLANS } from "@/plans";
import { LegalPage } from "../_components/legal";

export const metadata: Metadata = {
  title: "Terms of Service · Cuely",
  description: "The terms for using Cuely's site, MCP server and Pro plan.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" lede="The rules for using Cuely, kept short and plain.">
      <h2>The service</h2>
      <p>
        Cuely (cuely.dev) is run by {OPERATOR}, an individual based in Texas, USA. It offers a website and an MCP server
        that recommends tools and setup steps for software projects. By using either, you agree to these terms.
      </p>

      <h2>Recommendations</h2>
      <p>
        Cuely&apos;s picks come from its published rules and catalog. No vendor pays to be recommended, and there are no
        affiliate links. Recommendations are general guidance, not professional advice. Check that a tool fits your needs,
        its current pricing and its terms before you rely on it. You&apos;re responsible for what you build and deploy.
      </p>

      <h2>Accounts and API keys</h2>
      <p>
        You don&apos;t need an account to use Cuely. If you create one, keep your sign-in and API keys private. You&apos;re
        responsible for activity under your keys, and you can revoke a key at any time from your account page.
      </p>

      <h2>Fair use</h2>
      <p>
        Don&apos;t abuse the service: no attempts to break or overload it, get around rate limits, or resell access to the
        MCP server as your own product. Cuely may limit or suspend access that does.
      </p>

      <h2>Pro plan</h2>
      <ul>
        <li>
          <strong>Price:</strong> Pro is {PLANS.pro.priceLabel} in US dollars, plus any tax that applies where you live.
        </li>
        <li>
          <strong>Billing:</strong> Stripe sells and bills the subscription as merchant of record. It renews each month
          until you cancel.
        </li>
        <li>
          <strong>Cancelling:</strong> cancel anytime from Manage billing on your account page. Pro stays on until the end
          of the period you paid for, and there are no partial refunds unless the law requires one.
        </li>
        <li>
          <strong>Changes:</strong> if the price changes, subscribers get at least 30 days&apos; notice by email first.
        </li>
      </ul>
      <p>Every plan gets the same recommendations. Paying changes your limits, never the answers.</p>

      <h2>Availability</h2>
      <p>
        Cuely is provided as is, without warranties of any kind. It may change, pause or stop, and it won&apos;t always be
        available or error free. To the extent the law allows, Cuely&apos;s total liability to you is limited to what you
        paid for Cuely in the 12 months before the claim, and Cuely isn&apos;t liable for indirect or consequential losses.
      </p>

      <h2>Ending</h2>
      <p>
        You can stop using Cuely and ask for your account to be deleted at any time. Cuely may close accounts that break
        these terms.
      </p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of the State of Texas, USA.</p>

      <h2>Changes and contact</h2>
      <p>
        Updated terms go on this page with a new date, and big changes are emailed to account holders. Questions go to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See also the <a href="/privacy">Privacy Policy</a>.
      </p>
    </LegalPage>
  );
}
