import { notFound } from "next/navigation";
import { tools } from "@/catalog";
import type { Need } from "@/catalog";
import { NEED_LABELS } from "@/engine/needs";
import { CATALOG_YEAR, breadcrumbLd, categoryBySlug, formatDate, money, pageMeta, pairSlug, recipesUsing, toolBySlug, toolsIn } from "@/seo";
import { SITE_URL } from "@/site";
import { SiteFooter, SiteHeader } from "../../_components/chrome";
import { GuideCta } from "../../_components/guide-cta";
import { ToolLogo } from "../../_components/tool-logo";
import { Crumbs, JsonLd } from "../../_components/json-ld";

export const dynamicParams = false;

export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = toolBySlug.get((await params).slug);
  if (!t) return {};
  const others = toolsIn(t.category).filter((o) => o.slug !== t.slug).map((o) => o.name);
  return pageMeta({
    title: `${t.name} free plan, pricing and catches (${CATALOG_YEAR})`,
    description: `${t.summary} Free plan: ${t.freeTier ?? "none"}. ${others.length ? `Compared with ${others.join(", ")}.` : ""}`.slice(0, 300),
    path: `/tools/${t.slug}`,
  });
}

const yesNo = (v: boolean | null) => (v === null ? "Not stated" : v ? "Yes" : "No");

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = toolBySlug.get((await params).slug);
  if (!t) notFound();
  const cat = categoryBySlug.get(t.category)!;
  const rivals = toolsIn(t.category).filter((o) => o.slug !== t.slug);
  const used = recipesUsing(t.slug);
  const fits = (Object.entries(t.fit) as [Need, { weight: number; reason: string }][]).sort((a, b) => b[1].weight - a[1].weight);
  const strong = fits.filter(([, f]) => f.weight > 0);
  const weak = fits.filter(([, f]) => f.weight < 0);
  const crumbs = [
    { name: "Cuely", path: "/" },
    { name: "Tools", path: "/tools" },
    { name: cat.name, path: `/categories/${cat.slug}` },
    { name: t.name, path: `/tools/${t.slug}` },
  ];
  const monthly = money(t.cost?.monthly);

  return (
    <>
      <SiteHeader />
      <JsonLd
        data={[
          breadcrumbLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: t.name,
            url: t.website,
            applicationCategory: "DeveloperApplication",
            description: t.summary,
            ...(t.freeTier ? { offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: t.freeTier } } : {}),
          },
        ]}
      />
      <main id="main" className="wrap guide">
        <Crumbs items={crumbs} />
        <p className="eyebrow">
          {cat.name} · facts read {formatDate(t.verifiedOn)}
        </p>
        <h1 className="page-title title-logo">
          <ToolLogo slug={t.slug} name={t.name} size={44} />
          {t.name}
        </h1>
        <p className="page-lede">
          {t.summary} {t.pitch}
        </p>

        <dl className="fact-grid">
          <div>
            <dt>Free plan</dt>
            <dd>{t.freeTier ?? "None"}</dd>
          </div>
          <div>
            <dt>Paid from</dt>
            <dd>{t.paidStartsAt ?? "Not stated on the pricing page"}</dd>
          </div>
          <div>
            <dt>Monthly cost at 1,000 users</dt>
            <dd>
              {monthly ? `${monthly}/month` : (t.cost?.variable ?? "Not worked out")}
              {t.cost?.basis && <span className="muted small"> {t.cost.basis}</span>}
              {monthly && t.cost?.variable && <span className="muted small"> Plus {t.cost.variable}.</span>}
            </dd>
          </div>
          <div>
            <dt>Free plan allows commercial use</dt>
            <dd>{yesNo(t.freeTierCommercialUse)}</dd>
          </div>
          <div>
            <dt>Open source</dt>
            <dd>{t.openSource ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>Self-hostable</dt>
            <dd>{t.selfHostable ? "Yes" : "No"}</dd>
          </div>
        </dl>
        <p className="muted small">
          Source: <a href={t.pricingUrl} rel="nofollow noopener" target="_blank">{t.name} pricing</a>, read {formatDate(t.verifiedOn)}.
          Prices change; check the vendor&apos;s page before you commit.
        </p>

        <div className="two-col">
          <section aria-labelledby="best-title">
            <h2 id="best-title">Best for</h2>
            <ul className="guide-list">
              {t.bestFor.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="watch-title">
            <h2 id="watch-title">Watch out for</h2>
            <ul className="guide-list">
              {t.watchOut.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        </div>

        {(strong.length > 0 || weak.length > 0) && (
          <section className="panel" aria-labelledby="fit-title">
            <div className="panel-head">
              <h2 id="fit-title">How Cuely scores {t.name}</h2>
              <p className="muted">
                The published scores, from −3 to +3, that decide when Cuely picks it. <a href={`${SITE_URL}/#method`}>Method</a>
              </p>
            </div>
            <ul className="guide-list score-list">
              {[...strong, ...weak].map(([n, f]) => (
                <li key={n}>
                  <span className={`score ${f.weight > 0 ? "pos" : "neg"}`}>{f.weight > 0 ? `+${f.weight}` : `−${Math.abs(f.weight)}`}</span>
                  <strong>{NEED_LABELS[n]}.</strong> {f.reason}
                </li>
              ))}
            </ul>
          </section>
        )}

        {rivals.length > 0 && (
          <section className="panel" aria-labelledby="vs-title">
            <div className="panel-head">
              <h2 id="vs-title">{t.name} alternatives</h2>
            </div>
            <ul className="chip-list">
              {rivals.map((o) => (
                <li key={o.slug}>
                  <a href={`/compare/${pairSlug(t.slug, o.slug)}`}>
                    {t.name} vs {o.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {used.length > 0 && (
          <section className="panel" aria-labelledby="used-title">
            <div className="panel-head">
              <h2 id="used-title">Recipes with {t.name}</h2>
            </div>
            <ul className="guide-list">
              {used.map((u) => (
                <li key={u.recipe.slug}>
                  <a href={`/recipes/${u.recipe.slug}`}>{u.recipe.title}</a>
                  <span className="muted"> · {u.role === "pick" ? "the pick" : "an alternative"}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <GuideCta prompt={`Use Cuely to check whether ${t.name} is the right ${cat.name.toLowerCase()} pick for what I'm building.`} />
      </main>
      <SiteFooter />
    </>
  );
}
