import { categories, recipes, tools, POLICY } from "@/catalog";
import { recommendStack } from "@/engine/recommend";
import { ENDPOINT, KEY_PAGE, connectOptions } from "@/connect";
import { PLANS } from "@/plans";
import { ConnectTabs } from "./_components/connect-tabs";
import { SiteFooter, SiteHeader } from "./_components/chrome";
import { CopyButton } from "./_components/copy";
import { RevealObserver } from "./_components/reveal";
import { ToolLogo } from "./_components/tool-logo";
import { Transcript } from "./_components/transcript";

const DEMO_PROMPT = "I'm building a SaaS for a fintech startup";
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

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Home() {
  const demo = recommendStack({ categories, tools, recipes }, { description: DEMO_PROMPT });
  const demoRows = demo.stack.filter((s) => ["hosting", "database", "auth", "payments", "email", "storage"].includes(s.category));
  const verified = formatDate(tools[0].verifiedOn);
  const alphabetical = [...tools].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <SiteHeader />

      <main id="main">
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow">MCP server for coding agents</p>
            <h1>The honest second opinion your agent asks before it builds</h1>
            <p className="lede">
              Tell your agent what you&apos;re making. It asks Cuely which tools to use and how to set them up, and gets
              a stack with reasons, real free-plan limits and step-by-step recipes. Free with a quick sign-in, and no
              vendor can pay to be the answer.
            </p>
            <div className="endpoint">
              <span className="endpoint-label">Endpoint</span>
              <code>{ENDPOINT}</code>
              <CopyButton value={ENDPOINT} />
            </div>
            <a className="cta" href="#connect">
              Connect your agent <span aria-hidden="true">→</span>
            </a>
          </div>

          <Transcript
            prompt={`${DEMO_PROMPT}. Use Cuely for the stack.`}
            query="SaaS for a fintech startup"
            recipe={demo.productType.recipe}
            rows={demoRows.map((r) => ({
              category: r.categoryName.toLowerCase(),
              name: r.pick.name,
              reason: r.pick.reason,
              logo: <ToolLogo slug={r.pick.slug} name={r.pick.name} />,
            }))}
          />
        </section>

        <section className="field wrap" aria-labelledby="field-title" data-reveal>
          <h2 id="field-title" className="field-title">
            The {tools.length} tools Cuely weighs, A to Z. None of them pays to be here.
          </h2>
          <ul className="field-list">
            {alphabetical.map((t, i) => (
              <li key={t.slug} style={{ "--i": i } as React.CSSProperties}>
                <ToolLogo slug={t.slug} name={t.name} size={20} />
                <span>{t.name}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="how wrap" aria-labelledby="how-title">
          <h2 id="how-title" className="section-title" data-reveal>
            How it works
          </h2>
          <ol className="steps" data-reveal>
            <li>
              <span className="num">01</span>
              <h3>Your agent describes the build</h3>
              <p>
                One or two plain sentences: who it&apos;s for, what it does, and any constraints like budget, region,
                compliance or tools you already use.
              </p>
            </li>
            <li>
              <span className="num">02</span>
              <h3>Cuely matches needs to published rules</h3>
              <p>
                Words like B2B, fintech, EU or self-host become needs. Each tool has a published score for each need.
                The same question gets the same answer, for everyone.
              </p>
            </li>
            <li>
              <span className="num">03</span>
              <h3>The agent gets a plan it can follow</h3>
              <p>
                A pick per category with the reason, the free plan&apos;s actual limits, what to watch out for, and a
                full recipe when one fits.
              </p>
            </li>
          </ol>
        </section>

        <section id="connect" className="connect wrap" aria-labelledby="connect-title">
          <div className="connect-intro" data-reveal>
            <h2 id="connect-title" className="section-title">
              Connect in one step
            </h2>
            <p>
              Cuely speaks MCP over Streamable HTTP. Add it once and any session can use it. Then just ask:{" "}
              <q>Use Cuely to choose the stack for this.</q>
            </p>
            <p>
              It needs a free account: Claude signs you in when you connect. For other tools,{" "}
              <a href={KEY_PAGE}>get a free key</a> with Google or GitHub. Free includes{" "}
              {PLANS.free.perDay.toLocaleString("en-US")} tool calls a day.
            </p>
          </div>
          <ConnectTabs options={connect} />
        </section>

        <section className="tools wrap" aria-labelledby="tools-title">
          <h2 id="tools-title" className="section-title" data-reveal>
            Four tools, all read-only
          </h2>
          <dl className="tool-list">
            {mcpTools.map((t) => (
              <div key={t.name} className="tool-row" data-reveal>
                <dt>
                  <code className="tool-name">{t.name}</code>
                  <code className="tool-sig">({t.sig})</code>
                </dt>
                <dd>{t.what}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="catalog wrap" aria-labelledby="catalog-title">
          <div className="catalog-head" data-reveal>
            <h2 id="catalog-title" className="section-title">
              The catalog
            </h2>
            <p>
              {tools.length} tools across {categories.length} categories, plus {recipes.length} setup recipes:{" "}
              {recipes.map((r) => r.title.toLowerCase()).join(", ")}. Every free plan and price was read from the vendor&apos;s own site on {verified}.
            </p>
          </div>
          <table className="ledger" data-reveal>
            <caption className="sr-only">Categories, the default pick in each, and the other tools Cuely weighs</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Default pick</th>
                <th scope="col">Also weighed</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c, ci) => {
                const inCat = tools.filter((t) => t.category === c.slug).sort((a, b) => a.baseline - b.baseline);
                const [first, ...rest] = inCat;
                return (
                  <tr key={c.slug} style={{ "--i": ci } as React.CSSProperties}>
                    <th scope="row">
                      <span className="l-cat">{c.name}</span>
                      <span className="l-desc">{c.description}</span>
                    </th>
                    <td className="l-pick">
                      {first && (
                        <span className="l-tool">
                          <ToolLogo slug={first.slug} name={first.name} />
                          {first.name}
                          <span className="cue" aria-hidden="true" />
                        </span>
                      )}
                    </td>
                    <td className="l-rest">
                      <span className="sr-only">Also weighed: </span>
                      {rest.map((t, i) => (
                        <span key={t.slug} className="l-tool">
                          <ToolLogo slug={t.slug} name={t.name} />
                          {t.name}
                          {i < rest.length - 1 && <span className="sr-only">,</span>}
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="ledger-note">
            The default pick is where the rules land with no needs given. Describe your build and it can change.
          </p>
        </section>

        <section id="method" className="method" aria-labelledby="method-title">
          <div className="wrap method-inner" data-reveal>
            <h2 id="method-title">Money never touches the ranking</h2>
            <div className="method-body">
              <p className="method-lede">{POLICY}</p>
              <ul className="rules">
                <li>
                  <b>Published rules.</b> Each tool has a score from −3 to +3 for each need, with the reason written
                  next to it. A pick is the sum of the needs you described, plus a small editorial default that only
                  settles close calls.
                </li>
                <li>
                  <b>Same answer for everyone.</b> Free or Pro, no personalization, no live model call deciding your
                  stack. The same description returns the same stack.
                </li>
                <li>
                  <b>Facts from the source.</b> Free plans and prices come from each vendor&apos;s own pricing page,
                  with the date and the page in every answer. When a page is silent, Cuely says so instead of guessing.
                </li>
                <li>
                  <b>What you already use counts.</b> If a tool you have still fits, Cuely keeps it and tells you
                  switching isn&apos;t worth it.
                </li>
                <li>
                  <b>Recipes and picks agree.</b> Cuely matches what you&apos;re building to one recipe, and a tool that
                  recipe names gets one extra point, so the stack and the setup steps never point different ways.
                </li>
              </ul>
              <pre className="formula" aria-label="Scoring formula">
                <code>score = Σ fit[need] + 0.4 × (n − default_rank + 1) + (already_using ? 4 : 0) + (in_recipe ? 1 : 0)</code>
              </pre>
            </div>
          </div>
        </section>
      </main>
      <RevealObserver />

      <SiteFooter />
    </>
  );
}
