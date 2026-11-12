import { categories, recipes, signals, tools, POLICY, type Tool } from "@/catalog";
import { compareTools } from "@/engine/compare";
import { recommendStack, scoreTool } from "@/engine/recommend";
import { ENDPOINT, KEY_PAGE, connectOptions } from "@/connect";
import { checkoutOpen, paymentsConfig } from "@/billing/stripe";
import { PLANS } from "@/plans";
import { APP_URL, SITE_URL, SUPPORT_EMAIL } from "@/site";
import { SiteFooter, SiteHeader } from "./_components/chrome";
import { ConnectTabs } from "./_components/connect-tabs";
import { CopyButton } from "./_components/copy";
import { JsonLd } from "./_components/json-ld";
import { CategoryTabs, type CategoryTab } from "./_components/home/category-tabs";
import { DotField } from "./_components/home/dot-field";
import { HomeFx } from "./_components/home/fx";
import { ModeTabs, type Mode } from "./_components/home/mode-tabs";
import "./landing.css";

/*
  The landing page: one centred sheet framed by dashed guide lines, a blue panel to open
  and one to close, and hairline cell grids in between. Every fact on it comes from the
  catalog, the engine, the measured signals and the plans, so it can't drift from what the
  MCP server answers. Its styles live in landing.css, scoped under .hp.
*/

const DEMO_PROMPT = "I'm building a SaaS for a fintech startup";
const MODE_PROMPT = "B2B SaaS with team accounts and monthly billing";
const ALREADY_USING = ["supabase", "vercel"];
const TAB_CATEGORIES = ["hosting", "database", "auth", "payments", "email", "secrets", "monitoring", "llm"];
const snapshot = { categories, tools, recipes };
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
    text: "Each tool has a score from −3 to +3 for each need, with the reason written next to it. A pick is the sum of the needs you described, plus a small editorial default that settles close calls, plus a health number measured from each tool's outages, security advisories and adoption.",
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

const notes = [
  { tag: "3 tabs open", text: "“is it down again or is it me”" },
  { tag: "unresolved", text: "“which free plan allows commercial use?”" },
  { tag: "surprise", text: "The email bill went from $0 to $90 at launch" },
  { tag: "month 3", text: "“we have to migrate auth, SSO wasn't supported”" },
  { tag: "blog post, 2023", text: "“Top 10 free databases”" },
];

function formatDate(iso: string, withYear = true) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
}

function firstSentence(text: string) {
  const end = text.search(/\.(\s|$)/);
  return end === -1 ? text : text.slice(0, end + 1);
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** A category's tools in the order the engine would pick them with nothing else known. */
function ranked(slug: string): Tool[] {
  const inCat = tools.filter((t) => t.category === slug);
  return [...inCat].sort((a, b) => scoreTool(b, [], inCat.length, false) - scoreTool(a, [], inCat.length, false) || a.baseline - b.baseline);
}

function Icon({ d, className = "cell-ico" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICON = {
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5",
  gauge: "M4 18a8 8 0 1 1 16 0m-8 0 4-6",
  coin: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm2.5 5.700c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 2s1 1.700 2.500 2c1.5.3 2.5.8 2.5 2s-1 2-2.5 2c-1.100 0-2-.4-2.500-1.200M12 6.500V8m0 8v1.500",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  warn: "M12 3 2 20h20L12 3Zm0 7v4m0 3v.5",
  check: "m5 12.5 4.500 4.500L19 7.500",
  db: "M5 6c0-1.500 3.100-2.800 7-2.800S19 4.500 19 6s-3.100 2.800-7 2.800S5 7.500 5 6Zm0 0v12c0 1.500 3.100 2.800 7 2.800s7-1.300 7-2.800V6M5 12c0 1.500 3.100 2.800 7 2.800s7-1.300 7-2.800",
  shield: "M12 3 4.500 6v5.500c0 4.500 3.200 8.300 7.500 9.500 4.300-1.200 7.500-5 7.500-9.500V6L12 3Zm-3 9 2 2 4-4",
  key: "M8 11a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm3 1 8-8m-3 3 2 2m-4 0 2 2",
  card: "M5 5.500h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM3 10h18M7 15h4",
  mail: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm-1.500 1 8.500 7 8.500-7",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.500 2.700 3.800 5.700 3.800 9s-1.300 6.300-3.800 9c-2.500-2.700-3.800-5.700-3.800-9S9.500 5.700 12 3Z",
};

export default function Home() {
  const free = PLANS.free;
  const pro = PLANS.pro;
  const payments = paymentsConfig();
  const canCheckout = checkoutOpen(payments);
  const verified = formatDate(tools.reduce((latest, t) => (t.verifiedOn > latest ? t.verifiedOn : latest), tools[0].verifiedOn));
  const measured = signals.measuredOn ? formatDate(signals.measuredOn, false) : null;

  // The example answer in the hero's demo, straight from the engine.
  const demo = recommendStack(snapshot, { description: DEMO_PROMPT });
  const demoRows = demo.stack.filter((s) => s.role === "core").slice(0, 6);
  const cost = demo.summary?.cost ?? null;
  const costDetail = cost ? cost.text.slice(cost.text.indexOf(": ") + 2) : null;
  const catches = (demo.summary?.moreCatches.length ? demo.summary.moreCatches : (demo.summary?.catches ?? [])).slice(0, 3);

  // Category tabs: the engine's own order, and what moved it when the measured health did.
  const tabs: CategoryTab[] = TAB_CATEGORIES.flatMap((slug) => {
    const cat = categories.find((c) => c.slug === slug);
    const order = ranked(slug);
    if (!cat || order.length === 0) return [];
    const top = order[0];
    const editorial = [...order].sort((a, b) => a.baseline - b.baseline)[0];
    const rest =
      editorial.slug !== top.slug
        ? `Ranked above ${editorial.name} on the health measured ${measured ?? "this week"}: outages, security advisories and adoption.`
        : top.summary;
    return [{ slug, name: cat.name, lead: top.pitch, rest, free: top.freeTier ? firstSentence(top.freeTier) : null, tools: order.map((t) => ({ slug: t.slug, name: t.name })) }];
  });
  const moved = TAB_CATEGORIES.map((slug) => {
    const order = ranked(slug);
    const editorial = [...order].sort((a, b) => a.baseline - b.baseline)[0];
    return order[0] && editorial && order[0].slug !== editorial.slug ? { cat: categories.find((c) => c.slug === slug)?.name ?? slug, up: order[0].name, down: editorial.name } : null;
  }).find(Boolean);

  // The three ways to use it, each showing a real answer.
  const start = recommendStack(snapshot, { description: MODE_PROMPT });
  const check = recommendStack(snapshot, { description: MODE_PROMPT, alreadyUsing: ALREADY_USING });
  const versus = compareTools(snapshot, { a: "clerk", b: "workos-authkit", context: "an app that sells to enterprises" });
  const kept = check.stack.filter((s) => ALREADY_USING.includes(s.pick.slug));
  const added = check.stack.filter((s) => s.role === "core" && !ALREADY_USING.includes(s.pick.slug)).slice(0, 2);
  const costShort = (text?: string) => (text ? text.slice(0, text.indexOf(":") === -1 ? undefined : text.indexOf(":")) : "");
  const modes: Mode[] = [
    {
      id: "start",
      label: "Start a project",
      title: "Before the first commit",
      text: "Your agent describes the build in a sentence or two. Cuely answers with the picks that matter, what they cost and the catches to plan for, then points to a full recipe.",
      ask: `Use Cuely to choose the stack for a ${MODE_PROMPT}.`,
      rows: [
        { tone: "blue", tag: "Stack", text: start.summary?.headline ?? "", note: "A pick per category, each with its reason and free-plan limits" },
        { tone: "good", tag: "Cost", text: costShort(start.summary?.cost?.text), note: start.summary?.cost?.profile ? firstSentence(start.summary.cost.profile) : undefined },
        ...(start.summary?.catches[0] ? [{ tone: "warn" as const, tag: "Catch", text: start.summary.catches[0].text.replace(/\s*\(https?:[^)]*\)/, ""), note: `Checked ${formatDate(start.summary.catches[0].verifiedOn, false)}` }] : []),
        { tone: "blue", tag: "Recipe", text: start.productType.title ?? "", note: "Ordered steps, commands, starter files and pitfalls" },
      ],
    },
    {
      id: "check",
      label: "Check a project",
      title: "Halfway through",
      text: "Tell Cuely what you already use. It keeps a tool that still fits, says so, and fills the gaps around it with picks that work with what you have.",
      ask: `I already use Supabase and Vercel. Ask Cuely what else this ${MODE_PROMPT} needs.`,
      rows: [
        ...kept.map((s) => ({ tone: "good" as const, tag: "Keep", text: s.pick.name, note: s.pick.reason })),
        ...added.map((s) => ({ tone: "blue" as const, tag: "Add", text: `${s.pick.name} for ${s.categoryName.toLowerCase()}`, note: firstSentence(s.pick.reason) })),
        { tone: "good", tag: "Cost", text: costShort(check.summary?.cost?.text), note: "With the tools you already pay for counted in" },
      ],
    },
    {
      id: "compare",
      label: "Compare two tools",
      title: "When you're torn between two",
      text: "compare_tools puts two options in one category side by side and gives a verdict for what you're building, not in general.",
      ask: "Use Cuely to compare Clerk and WorkOS AuthKit for an app that sells to enterprises.",
      rows: versus.ok
        ? [
            { tone: "blue", tag: "Verdict", text: versus.verdict },
            ...versus.differences.slice(0, 2).map((d) => ({ tone: "good" as const, tag: d.b.weight > d.a.weight ? versus.tools[1].name : versus.tools[0].name, text: d.b.weight > d.a.weight ? d.b.reason : d.a.reason, note: `Better for: ${d.label}` })),
            ...(versus.tools[1].watchOut[0] ? [{ tone: "warn" as const, tag: "Catch", text: versus.tools[1].watchOut[0], note: host(versus.tools[1].pricingUrl) }] : []),
          ]
        : [],
    },
  ];

  const measuredTools = Object.values(signals.tools);
  const log = [
    ...(moved ? [{ a: moved.cat, b: `${moved.up} passes ${moved.down}`, c: "Published" }] : []),
    { a: "Outages", b: `${measuredTools.filter((t) => t.incidents).length} status pages read`, c: "Measured" },
    { a: "Adoption", b: `${measuredTools.filter((t) => t.downloads).length} packages tracked`, c: "Measured" },
    { a: "Prices", b: `${tools.length} vendor pricing pages`, c: "Checked" },
  ];
  const ticker = ["No vendor pays for placement", "Prices read from the vendor's own page", "Same answer for everyone", "Cost at 1,000 users up front", `${tools.length} tools across ${categories.length} categories`, `${recipes.length} step-by-step recipes`];
  const marquee = tools.filter((t) => !t.name.includes("(")).map((t) => t.name);
  const tiles = [ICON.db, ICON.shield, ICON.key, ICON.card, ICON.mail, ICON.globe];

  return (
    <div className="hp">
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "WebSite", name: "Cuely", url: `${SITE_URL}/` },
          { "@context": "https://schema.org", "@type": "Organization", name: "Cuely", url: `${SITE_URL}/`, logo: `${SITE_URL}/brand/icon-512.png`, email: SUPPORT_EMAIL },
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Cuely",
            url: `${SITE_URL}/`,
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Any (MCP server over HTTPS)",
            description: "A free MCP server coding agents ask which tools to use and how to set them up for what you're building. No vendor pays for placement.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD", name: free.name },
          },
        ]}
      />
      <SiteHeader />
      <HomeFx />

      <main id="main" className="gutter">
        <div className="sheet">
          <section className="panel-blue hero" aria-labelledby="hero-title">
            <DotField />
            <a className="eyebrow-on-blue" href="#method">
              <b>Live</b> {measured ? `Rankings measured ${measured} from outages, advisories and adoption` : "Rankings follow outages, advisories and adoption"}
            </a>
            <h1 id="hero-title">Know what to build with before your agent writes a line</h1>
            <p className="lede">
              Tell your agent what you&apos;re making. Cuely sends back a stack with the reason for each pick, real free-plan limits, the cost at
              1,000 users and step-by-step setup. Free with a quick sign-in, and no vendor can pay to be recommended.
            </p>
            <div className="ctas">
              <a className="pill pill-white" href={`${SITE_URL}/start`}>
                Get started free
              </a>
              <a className="pill pill-ghost" href="#demo">
                See an answer
              </a>
            </div>
            <div>
              <div className="endpoint">
                <span>MCP</span>
                <code>{ENDPOINT}</code>
                <CopyButton value={ENDPOINT} />
              </div>
            </div>
          </section>
        </div>

        <div className="sheet framed">
          <section id="demo" className="section" aria-labelledby="demo-title">
            <div className="s-head" data-rv>
              <h2 id="demo-title">One sentence in. A plan out.</h2>
              <p>Your agent describes the build. Cuely sends back a pick per category, the free plan&apos;s real limits and what it costs at 1,000 users.</p>
            </div>
            <div className="demo-wrap">
              <div className="demo" data-rv>
                <div className="term" data-term>
                  <div className="term-bar">
                    <i />
                    <i />
                    <i />
                    <span>recommend_stack · same answer for everyone</span>
                  </div>
                  <div className="term-body">
                    <div>
                      <p className="prompt">
                        &gt; <b>recommend_stack</b>(<em data-typed>&quot;{DEMO_PROMPT}&quot;</em>)
                      </p>
                      {demoRows.map((s, i) => (
                        <div className="stack-row" key={s.category} style={{ ["--i" as string]: i, ["--base" as string]: "1500ms" }}>
                          <span className="cat">{s.categoryName}</span>
                          <span>
                            <a className="pk" href={`/tools/${s.pick.slug}`}>
                              {s.pick.name}
                            </a>
                            <span className="why">{firstSentence(s.pick.reason)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div>
                      {cost && (
                        <>
                          <p className="t-label">Cost at 1,000 users</p>
                          <p className="cost-big" style={{ ["--base" as string]: "2300ms" }}>
                            $<span data-cost>{Math.round(cost.monthly)}</span>
                            <small>/ month</small>
                          </p>
                          <p className="cost-sub" style={{ ["--base" as string]: "2450ms" }}>
                            {costDetail}
                          </p>
                        </>
                      )}
                      <p className="t-label">Catches that change the plan</p>
                      {catches.map((c, i) => (
                        <div className="catch" key={c.text} style={{ ["--i" as string]: i, ["--base" as string]: "2700ms" }}>
                          <Icon d={ICON.warn} className="catch-ico" />
                          <div>
                            {c.text}
                            <small>
                              {host(c.source)} · checked {formatDate(c.verifiedOn, false)}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="cells c3 tick" data-rv-each>
              <div>
                <Icon d={ICON.layers} />
                <h3>A reason for every pick</h3>
                <p>Each tool has a published score for each need, with the reason written beside it. No live model picks the tools.</p>
              </div>
              <div>
                <Icon d={ICON.gauge} />
                <h3>Free plans as they really are</h3>
                <p>Limits and prices read from each vendor&apos;s own pricing page, with the page and the date in every answer.</p>
              </div>
              <div>
                <Icon d={ICON.coin} />
                <h3>The bill before the build</h3>
                <p>A monthly cost at 1,000 users, item by item, so the surprise invoice shows up now and not in month three.</p>
              </div>
            </div>
          </section>

          <section id="catalog" className="section" aria-labelledby="cat-title">
            <div className="s-head" data-rv>
              <h2 id="cat-title">
                {tools.length} tools. {categories.length} categories. Zero paid placement.
              </h2>
              <p>No vendor can pay to be listed or ranked, and there are no affiliate links.</p>
            </div>
            <div className="inner pad">
              <CategoryTabs tabs={tabs} />
            </div>
            <p className="marquee-note">And the rest of the catalog...</p>
            <div className="marquee" aria-hidden="true">
              <div className="marquee-track">
                {[...marquee, ...marquee].map((name, i) => (
                  <span key={i}>{name}</span>
                ))}
              </div>
            </div>
            <div className="parts tick">
              {categories.map((c) => {
                const order = ranked(c.slug);
                return (
                  <div key={c.slug}>
                    <h3>
                      <a href={`/categories/${c.slug}`}>{c.name}</a>
                      <span aria-hidden="true">{String(order.length).padStart(2, "0")}</span>
                    </h3>
                    <ul>
                      {order.map((t) => (
                        <li key={t.slug}>
                          <a href={`/tools/${t.slug}`}>{t.name}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="fine">
              Every free plan and price was read from the vendor&apos;s own site, most recently on {verified}. Each answer carries the date and the page.
            </p>
          </section>

          <section className="section" aria-labelledby="why-title">
            <div className="s-head" data-rv>
              <h2 id="why-title">Why builders run Cuely first</h2>
              <p>Your agent knows how to write code. It doesn&apos;t know this week&apos;s prices, limits and outages.</p>
            </div>
            <div className="split tick">
              <div className="chaos" data-rv>
                <h3>Guessing the stack</h3>
                {notes.map((n, i) => (
                  <div className={`note n${i + 1}`} key={n.tag}>
                    <span className="t">{n.tag}</span>
                    <br />
                    {n.text}
                  </div>
                ))}
              </div>
              <div className="calm" data-rv>
                <h3>Building with a plan</h3>
                <div className="calm-list">
                  {demoRows.slice(0, 3).map((s, i) => (
                    <div key={s.category} style={{ ["--i" as string]: i }}>
                      <span>{s.categoryName}</span>
                      <span>{s.pick.name}</span>
                    </div>
                  ))}
                  {cost && (
                    <div style={{ ["--i" as string]: 3 }}>
                      <span>Cost at 1,000 users</span>
                      <span>${Math.round(cost.monthly)} / month</span>
                    </div>
                  )}
                </div>
                <span className="ok" style={{ ["--i" as string]: 4 }}>
                  <Icon d={ICON.check} className="ok-ico" />
                  {measured ? `Rankings measured ${measured}` : "Rankings follow the data"}
                </span>
              </div>
            </div>
          </section>

          <section id="how" className="section" aria-labelledby="modes-title">
            <div className="s-head" data-rv>
              <h2 id="modes-title">At the start, and halfway through</h2>
              <p>Ask once before your agent builds. Ask again when the project has grown and the picks may no longer fit.</p>
            </div>
            <ModeTabs modes={modes} />
          </section>

          <section id="recipes" className="section" aria-labelledby="rec-title">
            <div className="s-head" data-rv>
              <h2 id="rec-title">{recipes.length} recipes your agent can follow step by step</h2>
              <p>Ordered steps, commands, starter files and compliance notes. The recipe and the picks always name the same tools.</p>
            </div>
            <div className="cells c3 wrap3 tick" data-rv-each>
              {recipes.map((r) => (
                <a key={r.slug} href={`/recipes/${r.slug}`} className="recipe">
                  <span className="label">Recipe · {r.steps.length} steps</span>
                  <h3>{r.title}</h3>
                  <p>{firstSentence(r.summary)}</p>
                  <p className="recipe-stack">
                    {r.stack
                      .filter((s) => !s.optional)
                      .slice(0, 3)
                      .map((s) => tools.find((t) => t.slug === s.tool)?.name ?? s.tool)
                      .join(" · ")}
                  </p>
                </a>
              ))}
            </div>
          </section>

          <section id="connect" className="section" aria-labelledby="connect-title">
            <div className="s-head" data-rv>
              <h2 id="connect-title">Connect in one step</h2>
              <p>
                Cuely speaks MCP over Streamable HTTP. Add it once and any session can use it, then ask: <q>Use Cuely to choose the stack for this.</q>
              </p>
            </div>
            <div className="connect tick">
              <div data-rv>
                <h3>It needs a free account</h3>
                <p>
                  Claude signs you in when you connect. For other tools, <a href={KEY_PAGE}>get a free key</a> with Google or GitHub. Free includes{" "}
                  {free.perDay.toLocaleString("en-US")} tool calls a day.
                </p>
                <dl className="spec">
                  {mcpTools.map((t) => (
                    <div key={t.name}>
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
              </div>
              <div data-rv>
                <ConnectTabs options={connect} />
              </div>
            </div>
          </section>

          <section id="pricing" className="section" aria-labelledby="price-title">
            <div className="s-head" data-rv>
              <h2 id="price-title">Free for solo builders, with Pro for teams</h2>
              <p>Pro raises your daily and per-minute limits. The recommendations, recipes and reasons are the same on every plan.</p>
            </div>
            <div className="plans tick" data-rv>
              <div className="plan">
                <h3>{free.name}</h3>
                <p className="for">{free.summary}</p>
                <p className="amt">
                  {free.priceLabel} <small>/ month</small>
                </p>
                <div className="chips">
                  {free.features.map((f) => (
                    <span key={f}>{f}</span>
                  ))}
                </div>
                <a className="pill" href={`${APP_URL}/sign-up`}>
                  Create a free account
                </a>
              </div>
              <div className="plan">
                <h3>
                  {pro.name}
                  {payments.mode === "test" && canCheckout && <span className="soon">Test mode</span>}
                </h3>
                <p className="for">{pro.summary}</p>
                <p className="amt">
                  ${pro.priceCents / 100} <small>/ month</small>
                </p>
                <div className="chips">
                  {pro.features.map((f) => (
                    <span key={f}>{f}</span>
                  ))}
                </div>
                <a className="pill pill-solid" href={`${APP_URL}/account`}>
                  Upgrade to Pro
                </a>
              </div>
            </div>
            <div className="dotband" />
            <p className="fine">
              Limits are per account, across all its keys. A tool call is one question your agent asks Cuely; connecting and listing tools don&apos;t count.
              Stripe handles every payment. <a href={`${SITE_URL}/pricing`}>Full pricing</a>
            </p>
          </section>

          <section id="method" className="section" aria-labelledby="method-title">
            <div className="s-head" data-rv>
              <h2 id="method-title">Rankings that follow the data</h2>
              <p>{POLICY}</p>
            </div>
            <div className="inner pad">
              <div className="bento" data-rv-each>
                <div>
                  <div className="log" data-log aria-label="Latest measurements">
                    {log.map((l) => (
                      <div key={l.a}>
                        <b>{l.a}</b>
                        <span>{l.b}</span>
                        <span className="st">
                          {l.c} <i />
                        </span>
                      </div>
                    ))}
                  </div>
                  <h3>Measured every week, published without anyone touching it</h3>
                  <p>
                    A scheduled job reads each vendor&apos;s status page, security advisories, package downloads and pricing page
                    {measured ? `, last on ${measured}` : ""}. If a tool gets worse, Cuely stops recommending it.
                  </p>
                </div>
                <div className="b-blue">
                  <Icon d={ICON.pulse} className="b-ico" />
                  <h3>{rules[0].title}</h3>
                  <p>{rules[0].text}</p>
                </div>
                {rules.slice(1).map((r) => (
                  <div key={r.title}>
                    <h3>{r.title}</h3>
                    <p>{r.text}</p>
                  </div>
                ))}
              </div>
              <pre className="formula" aria-label="Scoring formula" data-rv>
                <code>
                  score = <span>Σ fit[need]</span> + 0.4 × (n − default_rank + 1) + <span>health</span> + <span>compliance</span> + (already_using ? 4 : 0) + (in_recipe ? 1 : 0)
                </code>
              </pre>
            </div>
          </section>
        </div>

        <div className="sheet">
          <section className="panel-blue closing" aria-labelledby="close-title">
            <DotField />
            {tiles.map((d, i) => (
              <div className={`tile t${i + 1}`} key={i}>
                <Icon d={d} className="tile-ico" />
              </div>
            ))}
            <h2 id="close-title" data-rv>
              Skip the research. Start building.
            </h2>
            <p>
              {recipes.length} setup recipes, {tools.length} tools across {categories.length} categories, and the same answer for everyone. Free with a
              quick sign-in.
            </p>
            <div className="ctas">
              <a className="pill pill-white" href={`${SITE_URL}/start`}>
                Get started free
              </a>
              <a className="pill pill-ghost" href="#connect">
                See the setup
              </a>
            </div>
            <div className="ticker" aria-hidden="true">
              <div className="ticker-track">
                {[...ticker, ...ticker].map((t, i) => (
                  <span key={i}>
                    <Icon d={ICON.check} className="tick-ico" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
