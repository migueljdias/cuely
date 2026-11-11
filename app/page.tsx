import { categories, recipes, tools, POLICY } from "@/catalog";
import { recommendStack } from "@/engine/recommend";
import { ENDPOINT, KEY_PAGE, connectOptions } from "@/connect";
import { checkoutOpen, paymentsConfig } from "@/billing/stripe";
import { PLANS } from "@/plans";
import { authConfigured } from "@/auth/server";
import { APP_URL, SITE_URL, SUPPORT_EMAIL } from "@/site";
import { ConnectTabs } from "./_components/connect-tabs";
import { CopyButton } from "./_components/copy";
import { HeaderAccount } from "./_components/header-account";
import { JsonLd } from "./_components/json-ld";
import { PixelLogo, PixelSprite, StackFigure } from "./_components/blueprint/pixels";
import "./landing.css";

/*
  The landing page, drawn as a drafting sheet: a graph-paper grid behind everything, each
  section a plate with crop marks, mono figure labels, and a title block for the footer.
  Every fact on it comes from the catalog, the engine and the plans, so it can't drift.
  Its styles live in landing.css, scoped under .bp, so no other page changes.
*/

const DEMO_PROMPT = "I'm building a SaaS for a fintech startup";
const DEMO_QUERY = "SaaS for a fintech startup";
const FIGURE_CATEGORIES = ["hosting", "database", "auth", "payments", "email", "storage"];
const connect = connectOptions();

const mcpTools = [
  {
    name: "recommend_stack",
    sig: "description, answers?, detail?, already_using?, avoid?",
    what: "The picks that matter, the monthly cost at 1,000 users and the catches that change the plan, then one line per category. Asks a short question first when the answer would change the pick, and says so when a product is outside its coverage.",
  },
  {
    name: "get_recipe",
    sig: "product_type, include_steps?",
    what: "The full build: ordered steps, commands, starter files, best practices, pitfalls and compliance notes.",
  },
  {
    name: "compare_tools",
    sig: "a, b, context?",
    what: "Two options in one category, side by side, with a verdict for what you're building.",
  },
  {
    name: "list_categories",
    sig: "category?",
    what: "Browse the catalog: every tool's free plan, starting price and the page those facts came from.",
  },
];

const rules = [
  {
    title: "Published rules",
    text: "Each tool has a score from −3 to +3 for each need, with the reason written next to it. A pick is the sum of the needs you described, plus a small editorial default that only settles close calls.",
  },
  {
    title: "Same answer for everyone",
    text: "Your plan, account and history play no part, and no live model call picks the tools, so the same description always returns the same stack.",
  },
  {
    title: "Facts from the source",
    text: "Free plans and prices come from each vendor's own pricing page, with the date and the page in every answer. When a pricing page doesn't state a fact, Cuely says so instead of guessing.",
  },
  {
    title: "What you already use counts",
    text: "If a tool you have still fits, Cuely keeps it and tells you switching isn't worth it.",
  },
  {
    title: "Recipes and picks agree",
    text: "Cuely matches what you're building to one recipe, and a tool that recipe names gets one extra point, so the stack and the setup steps name the same tools.",
  },
];

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Wordmark({ height = 28 }: { height?: number }) {
  return (
    <picture>
      <source srcSet="/brand/cuely-logo-dark.svg" media="(prefers-color-scheme: dark)" />
      <img src="/brand/cuely-logo-light.svg" alt="Cuely" width={Math.round((height * 712.5) / 224)} height={height} />
    </picture>
  );
}

function PixelArrow() {
  return <i className="bp-arrow" aria-hidden="true" />;
}

export default function Home() {
  const demo = recommendStack({ categories, tools, recipes }, { description: DEMO_PROMPT });
  const figureRows = FIGURE_CATEGORIES.map((slug) => demo.stack.find((s) => s.category === slug))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({ category: s.categoryName.toLowerCase(), name: s.pick.name, reason: s.pick.reason }));
  const monthly = demo.summary?.cost?.monthly;
  const costLine = monthly != null ? `About $${Math.round(monthly)}/month at 1,000 users` : "Cost at 1,000 users in every answer";
  const verified = formatDate(tools[0].verifiedOn);
  const payments = paymentsConfig();
  const canCheckout = checkoutOpen(payments);
  const free = PLANS.free;
  const pro = PLANS.pro;

  return (
    <div className="bp">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Cuely",
            url: `${SITE_URL}/`,
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Cuely",
            url: `${SITE_URL}/`,
            logo: `${SITE_URL}/brand/icon-512.png`,
            email: SUPPORT_EMAIL,
          },
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Cuely",
            url: `${SITE_URL}/`,
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Any (MCP server over HTTPS)",
            description:
              "A free MCP server coding agents ask which tools to use and how to set them up for what you're building. No vendor pays for placement.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD", name: free.name },
          },
        ]}
      />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="bp-nav">
        <div className="bp-wrap">
          <a href={`${SITE_URL}/`} className="bp-home" aria-label="Cuely home">
            <Wordmark />
          </a>
          <nav aria-label="Primary">
            <a className="bp-wide" href="#how">
              How it works
            </a>
            <a className="bp-wide" href={`${SITE_URL}/recipes`}>
              Recipes
            </a>
            <a className="bp-wide" href={`${SITE_URL}/tools`}>
              Tools
            </a>
            <a href={`${SITE_URL}/pricing`}>Pricing</a>
            {authConfigured() ? (
              <HeaderAccount />
            ) : (
              <a className="bp-btn bp-btn-ink bp-btn-sm" href={`${APP_URL}/sign-in`}>
                Sign in
              </a>
            )}
          </nav>
        </div>
      </header>

      <main id="main">
        <div className="bp-wrap bp-hero">
          <div className="bp-hero-copy">
            <p className="bp-label">MCP server for coding agents</p>
            <h1>
              Your agent asks Cuely which tools to use <span className="bp-dim">before it builds</span>
            </h1>
            <p className="bp-lede">
              Tell your agent what you&apos;re making. Cuely sends back a stack with the reason for each pick, real
              free-plan limits and step-by-step setup recipes. It&apos;s free with a quick sign-in, and no vendor can pay
              to be recommended.
            </p>
            <div className="bp-endpoint">
              <span>Endpoint</span>
              <code>{ENDPOINT}</code>
              <CopyButton value={ENDPOINT} />
            </div>
            <div className="bp-ctas">
              <a className="bp-cta" href={`${SITE_URL}/start`}>
                Get started free <PixelArrow />
              </a>
              <a className="bp-link" href="#connect">
                See the setup
              </a>
            </div>
          </div>
          <StackFigure rows={figureRows} cost={costLine} call={`recommend_stack("${DEMO_QUERY}")`} />
        </div>

        <section className="bp-wrap bp-section" aria-labelledby="parts-title">
          <div className="bp-head">
            <p className="bp-label">Parts list</p>
            <h2 id="parts-title">The {tools.length} tools Cuely chooses from, and no vendor pays to be listed</h2>
          </div>
          <div className="bp-parts">
            {categories.map((c) => {
              const inCat = tools.filter((t) => t.category === c.slug).sort((a, b) => a.baseline - b.baseline);
              return (
                <div key={c.slug}>
                  <h3>
                    <a href={`/categories/${c.slug}`}>{c.name}</a>
                    <span aria-hidden="true">{String(inCat.length).padStart(2, "0")}</span>
                  </h3>
                  <ul>
                    {inCat.map((t) => (
                      <li key={t.slug}>
                        <a href={`/tools/${t.slug}`}>{t.name}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="bp-note">
            Every free plan and price was read from the vendor&apos;s own site on {verified}. Each answer carries the date
            and the page. {recipes.length} full setup recipes:{" "}
            {recipes.map((r, i) => (
              <span key={r.slug}>
                {i > 0 && "; "}
                <a href={`/recipes/${r.slug}`}>{r.title.toLowerCase()}</a>
              </span>
            ))}
            .
          </p>
        </section>

        <section id="how" className="bp-wrap bp-section" aria-labelledby="how-title">
          <div className="bp-head">
            <p className="bp-label">Procedure</p>
            <h2 id="how-title">How it works</h2>
          </div>
          <ol className="bp-steps">
            <li>
              <PixelSprite name="chat" />
              <span className="bp-label">Step 1</span>
              <h3>Your agent describes the build</h3>
              <p>
                One or two plain sentences: who it&apos;s for, what it does, and any constraints like budget, region,
                compliance or tools you already use.
              </p>
            </li>
            <li>
              <PixelSprite name="rules" />
              <span className="bp-label">Step 2</span>
              <h3>Cuely matches needs to published rules</h3>
              <p>
                Words like B2B, fintech, EU or self-host become needs. Each tool has a published score for each need,
                so two people who describe the same product get the same stack.
              </p>
            </li>
            <li>
              <PixelSprite name="plan" />
              <span className="bp-label">Step 3</span>
              <h3>The agent gets a plan it can follow</h3>
              <p>
                A pick per category with the reason, the free plan&apos;s actual limits, what to watch out for, and a
                full recipe when one fits.
              </p>
            </li>
          </ol>
        </section>

        <section id="connect" className="bp-wrap bp-section bp-connect" aria-labelledby="connect-title">
          <div className="bp-head">
            <p className="bp-label">Assembly</p>
            <h2 id="connect-title">Connect in one step</h2>
            <p>
              Cuely speaks MCP over Streamable HTTP. Add it once and any session can use it. Then just ask:{" "}
              <q>Use Cuely to choose the stack for this.</q>
            </p>
            <p>
              It needs a free account: Claude signs you in when you connect. For other tools,{" "}
              <a href={KEY_PAGE}>get a free key</a> with Google or GitHub. Free includes{" "}
              {free.perDay.toLocaleString("en-US")} tool calls a day.
            </p>
          </div>
          <div className="bp-plate bp-connect-plate">
            <div className="bp-fig">
              <span>Fig. 2 · Client setup</span>
              <span aria-hidden="true">MCP</span>
            </div>
            <ConnectTabs options={connect} />
          </div>
        </section>

        <section className="bp-wrap bp-section" aria-labelledby="tools-title">
          <div className="bp-head">
            <p className="bp-label">Specification</p>
            <h2 id="tools-title">Four tools, all read-only</h2>
          </div>
          <dl className="bp-spec">
            {mcpTools.map((t) => (
              <div key={t.name} className="bp-spec-row">
                <dt>
                  <code>
                    {t.name}
                    <span>({t.sig})</span>
                  </code>
                </dt>
                <dd>{t.what}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="method" className="bp-method" aria-labelledby="method-title">
          <div className="bp-wrap">
            <div>
              <p className="bp-label">Method</p>
              <h2 id="method-title">How Cuely ranks tools</h2>
              <p className="bp-method-lede">{POLICY}</p>
            </div>
            <ul className="bp-rules">
              {rules.map((r) => (
                <li key={r.title}>
                  <b>{r.title}</b>
                  {r.text}
                </li>
              ))}
            </ul>
            <pre className="bp-formula" aria-label="Scoring formula">
              <span aria-hidden="true">Scoring formula</span>
              <code>score = Σ fit[need] + 0.4 × (n − default_rank + 1) + (already_using ? 4 : 0) + (in_recipe ? 1 : 0)</code>
            </pre>
          </div>
        </section>

        <section id="pricing" className="bp-wrap bp-section" aria-labelledby="price-title">
          <div className="bp-head">
            <p className="bp-label">Schedule of rates</p>
            <h2 id="price-title">Free for solo builders, with Pro for teams</h2>
            <p>Pro raises your daily and per-minute limits. The recommendations, recipes and reasons are the same on every plan.</p>
          </div>
          <div className="bp-plans">
            <div className="bp-plate bp-plan">
              <h3 className="bp-label">{free.name}</h3>
              <p className="bp-price">{free.priceLabel}</p>
              <p className="bp-summary">{free.summary}</p>
              <ul>
                {free.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <a className="bp-btn bp-btn-line" href={`${APP_URL}/sign-up`}>
                Create a free account
              </a>
            </div>
            <div className="bp-plate bp-plan">
              <h3 className="bp-label">
                {pro.name}
                {payments.mode === "test" && canCheckout && <span className="bp-tag">Test mode</span>}
              </h3>
              <p className="bp-price">
                ${pro.priceCents / 100} <small>a month</small>
              </p>
              <p className="bp-summary">{pro.summary}</p>
              <ul>
                {pro.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <a className="bp-btn bp-btn-ink" href={`${APP_URL}/account`}>
                Upgrade to Pro
              </a>
            </div>
          </div>
          <p className="bp-note bp-note-sans">
            Limits are per account, across all its keys. A tool call is one question your agent asks Cuely; connecting
            and listing tools don&apos;t count. Stripe handles every payment. <a href={`${SITE_URL}/pricing`}>Full pricing</a>
          </p>
        </section>

        <section className="bp-wrap bp-section bp-final" aria-labelledby="final-title">
          <div className="bp-plate">
            <p className="bp-label">Ready to build</p>
            <h2 id="final-title">Give your agent a plan before it writes a line</h2>
            <p>
              {recipes.length} setup recipes, {tools.length} tools across {categories.length} categories, and the same
              answer for everyone. Free with a quick sign-in.
            </p>
            <div className="bp-ctas">
              <a className="bp-cta" href={`${SITE_URL}/start`}>
                Get started free <PixelArrow />
              </a>
              <a className="bp-link" href="#connect">
                See the setup
              </a>
            </div>
            <PixelLogo />
          </div>
        </section>
      </main>

      <footer className="bp-wrap bp-footer">
        <div className="bp-titleblock">
          <div className="bp-tb">
            <Wordmark height={24} />
            <p>Stacks and setup steps for what you&apos;re building, from published rules. No vendor pays for placement.</p>
          </div>
          <div className="bp-tb">
            <span className="bp-label">Product</span>
            <nav aria-label="Product">
              <a href="#how">How it works</a>
              <a href={`${SITE_URL}/start`}>Get started</a>
              <a href={`${SITE_URL}/recipes`}>Recipes</a>
              <a href={`${SITE_URL}/tools`}>Tools</a>
              <a href={`${SITE_URL}/pricing`}>Pricing</a>
              <a href="#method">Method</a>
            </nav>
          </div>
          <div className="bp-tb">
            <span className="bp-label">Resources</span>
            <nav aria-label="Resources">
              <a href={`${SITE_URL}/llms.txt`}>llms.txt</a>
              <a href={`${SITE_URL}/privacy`}>Privacy</a>
              <a href={`${SITE_URL}/terms`}>Terms</a>
            </nav>
          </div>
          <div className="bp-tb">
            <span className="bp-label">Support</span>
            <a className="bp-addr" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </div>
          <div className="bp-strip">
            <span>Project: Cuely</span>
            <span>Sheet: landing, 1 of 1</span>
            <span>Catalog checked: {verified}</span>
            <span>© 2026 Cuely</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
