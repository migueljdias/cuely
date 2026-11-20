import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/site";
import { LegalPage } from "../_components/legal";

export const metadata: Metadata = {
  title: "What Cuely receives · Cuely",
  description:
    "Cuely never sees your code. What your agent sends when it calls Cuely, what Cuely keeps, and how to check what's sent before it leaves your machine.",
  alternates: { canonical: "/trust" },
};

// A real check_project call, as an agent sends it after reading package.json on your machine.
const EXAMPLE = `{
  "tool": "check_project",
  "arguments": {
    "description": "Next.js app where therapists keep patient notes, now adding EU customers",
    "using": ["Vercel", "Supabase", "Clerk", "Stripe", "Resend"]
  }
}`;

export default function Trust() {
  return (
    <LegalPage
      title="What Cuely receives"
      lede="Cuely never sees your code. Your agent reads your project on your own machine and sends Cuely a sentence about the product and a list of tool names. This page shows exactly what that looks like, what Cuely keeps, and how to check it before anything is sent."
    >
      <h2>What your agent sends</h2>
      <p>
        Cuely is a remote MCP server. It can&apos;t open files, run commands or read your repository: it only sees what
        your agent puts in the call. When you ask &quot;check my stack&quot;, the agent reads <code>package.json</code> and
        your config files locally, then sends something like this:
      </p>
      <div className="codeblock" style={{ paddingRight: 16 }}>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{EXAMPLE}</pre>
      </div>
      <p>
        That&apos;s the whole request: a plain description of the product (at most 2,000 characters) and tool names (at
        most 40). Some tools also take a few fixed choices, such as web or phone app and who pays whom.
      </p>

      <h2>What Cuely never asks for</h2>
      <ul>
        <li>Source code or the contents of any file</li>
        <li>Environment variable values, API keys or other secrets</li>
        <li>Git history, file paths or your repository&apos;s name</li>
      </ul>
      <p>
        Cuely&apos;s instructions to agents say so in plain words: send the product in plain words and tool names, never
        code, file contents, env values, secrets, or the names of people, customers or companies. The description is free
        text, so if an agent adds more than it should, that text is used for that one answer and then dropped.
      </p>

      <h2>What Cuely keeps</h2>
      <p>For each call, one row with these five fields and nothing else:</p>
      <ul>
        <li>which tool was called, such as <code>check_project</code></li>
        <li>which recipe it matched, such as <code>b2b-saas</code>, if any</li>
        <li>which categories the answer covered, such as hosting and auth</li>
        <li>which needs Cuely detected, from a fixed list such as <code>eu</code> or <code>health_data</code></li>
        <li>
          a short hash of your account that changes every day, so Cuely can count unique callers per day without being able
          to follow anyone from one day to the next
        </li>
      </ul>
      <p>
        Cuely does not keep the description, the tool list, the comparison context or your IP address. It also counts your
        account&apos;s calls per day and per minute to apply your plan&apos;s limits. An automated test calls every tool
        with marked text in every field and fails the build if any of that text is stored, so this can&apos;t change by
        accident.
      </p>

      <h2>What passes through without being kept</h2>
      <p>
        Vercel hosts Cuely, so your request passes through Vercel&apos;s network on its way to the server. When something
        breaks, Cuely&apos;s error log records the path and the error, and leaves out request bodies and headers on
        purpose. The full list of services and what each one handles is in the <a href="/privacy">privacy policy</a>.
      </p>

      <h2>Check it yourself</h2>
      <p>
        Claude Code and most MCP clients show the exact arguments of every tool call and ask you to allow it before
        anything is sent. Read the payload, then allow or deny it. If it ever holds more than this page describes, deny the
        call and tell us.
      </p>

      <h2>Questions</h2>
      <p>
        Found something that doesn&apos;t match this page, or want to report a security problem? Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
