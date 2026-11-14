import { ENDPOINT, KEY_PAGE, connectOptions } from "@/connect";
import { MCP_TOOLS } from "@/mcp/tool-docs";
import { PLANS } from "@/plans";
import { pageMeta, breadcrumbLd } from "@/seo";
import { SITE_URL } from "@/site";
import { SiteFooter, SiteHeader } from "../_components/chrome";
import { ConnectTabs } from "../_components/connect-tabs";
import { CopyButton } from "../_components/copy";
import { Crumbs, JsonLd } from "../_components/json-ld";

export const metadata = pageMeta({
  title: "Get started with Cuely: connect the MCP server in 2 minutes",
  description:
    "Add Cuely's free MCP server to Claude, Claude Code, Cursor or VS Code, then ask your agent to pick the stack and setup steps for what you're building.",
  path: "/start",
});

const FIRST_PROMPTS = [
  "Use Cuely to choose the stack for a B2B SaaS with team accounts and monthly billing.",
  "Ask Cuely for the setup recipe for a marketplace where customers pay providers and I keep 15%.",
  "Use Cuely to compare Clerk and WorkOS AuthKit for an app that sells to enterprises.",
  "I already use Supabase and Vercel. Ask Cuely what else this AI docs app needs, and what it costs at 1,000 users.",
];

const FAQ = [
  {
    q: "Is Cuely free?",
    a: `Yes. The Free plan includes every tool, recipe and recommendation, ${PLANS.free.perDay} tool calls a day and ${PLANS.free.perMinute} requests a minute. You only need a free account, made with Google or GitHub.`,
  },
  {
    q: "Which AI tools does Cuely work with?",
    a: "Any client that supports remote MCP servers over Streamable HTTP: the Claude app, Claude Code, Cursor, VS Code and others. The Claude app signs you in with OAuth; the rest send a free API key.",
  },
  {
    q: "Do vendors pay to be recommended?",
    a: "No. Picks come from published rules in an open catalog. No vendor can pay for placement, and there are no affiliate links.",
  },
  {
    q: "What does my agent get back?",
    a: "A pick per category with the reason, the free plan's real limits, the monthly cost at 1,000 users, the catches that change the plan, and step-by-step setup recipes when one fits.",
  },
  {
    q: "Does Cuely see my code?",
    a: "No. Your agent sends a short description of what you're building. Cuely's tools are read-only and never touch your files.",
  },
];

export default function Start() {
  const steps = [
    { name: "Pick your AI tool", text: "Choose Claude, Claude Code, Cursor, VS Code or any MCP client below." },
    { name: "Get a free key", text: "Sign in with Google or GitHub and create a key. The Claude app skips this: it signs you in when you connect." },
    { name: "Add Cuely", text: `Paste the config for your tool. The endpoint is ${ENDPOINT}.` },
    { name: "Ask your first question", text: "Ask your agent to use Cuely to choose the stack for what you're building." },
  ];
  return (
    <>
      <SiteHeader />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "Connect Cuely's MCP server to your coding agent",
            totalTime: "PT2M",
            step: steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text })),
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
          breadcrumbLd([
            { name: "Cuely", path: "/" },
            { name: "Get started", path: "/start" },
          ]),
        ]}
      />
      <main id="main" className="wrap guide start">
        <Crumbs items={[{ name: "Cuely", path: "/" }, { name: "Get started", path: "/start" }]} />
        <h1 className="page-title">Get started in two minutes</h1>
        <p className="page-lede">
          Connect Cuely once, and your coding agent can ask it which tools to use, and how to set them up, before it
          writes a line. Free with a quick sign-in.
        </p>

        <ol className="start-steps">
          <li>
            <h2>Get a free key</h2>
            <p>
              Sign in with Google or GitHub, then select <strong>Create key</strong> on your account page. Using the Claude
              app? Skip this step: Claude signs you in when you connect.
            </p>
            <a className="btn btn-primary" href={KEY_PAGE}>
              Get a free key
            </a>
          </li>
          <li>
            <h2>Add Cuely to your AI tool</h2>
            <p>
              Pick your tool and paste the config. Replace <code>YOUR_CUELY_KEY</code> with your key, or copy the
              ready-filled version from your account page.
            </p>
            <div className="endpoint">
              <span className="endpoint-label">Endpoint</span>
              <code>{ENDPOINT}</code>
              <CopyButton value={ENDPOINT} />
            </div>
            <ConnectTabs options={connectOptions()} />
          </li>
          <li>
            <h2>Ask your first question</h2>
            <p>Start a new chat so your tool loads Cuely, then paste one of these, or describe your own project:</p>
            <ul className="prompt-list">
              {FIRST_PROMPTS.map((p) => (
                <li key={p} className="codeblock">
                  <pre>
                    <code>{p}</code>
                  </pre>
                  <CopyButton value={p} />
                </li>
              ))}
            </ul>
            <p className="muted small">
              Your agent gets back a pick per category with the reason, real free-plan limits, the monthly cost at 1,000
              users and the catches to plan for. Browse the same answers on the{" "}
              <a href="/recipes">recipes</a> and <a href="/tools">tools</a> pages.
            </p>
          </li>
        </ol>

        <section className="panel" id="tools" aria-labelledby="tools-title">
          <div className="panel-head">
            <h2 id="tools-title">Tools</h2>
            <p>Cuely&apos;s MCP server has six tools. All are read-only: they take a description and return advice.</p>
          </div>
          <dl className="faq tool-ref">
            {MCP_TOOLS.map((t) => (
              <div key={t.name}>
                <dt>
                  <code>{t.name}</code> <span className="muted">({t.sig})</span>
                </dt>
                <dd>{t.what}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="panel" aria-labelledby="trouble-title">
          <div className="panel-head">
            <h2 id="trouble-title">If Cuely doesn&apos;t show up</h2>
          </div>
          <ul className="guide-list">
            <li>Start a new chat or restart your tool after adding the server; most tools load MCP servers at start.</li>
            <li>
              A 401 error means the key is missing or wrong. Check the <code>Authorization: Bearer</code> header, or make a
              new key on your <a href={KEY_PAGE}>account page</a>.
            </li>
            <li>A 429 error means you hit the day&apos;s limit. It resets at 00:00 UTC.</li>
            <li>
              Opening <a href={`${SITE_URL}/api/mcp`}>{ENDPOINT}</a> in a browser shows the setup page; that&apos;s expected.
            </li>
          </ul>
        </section>

        <section className="panel" aria-labelledby="faq-title">
          <div className="panel-head">
            <h2 id="faq-title">Questions</h2>
          </div>
          <dl className="faq">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
