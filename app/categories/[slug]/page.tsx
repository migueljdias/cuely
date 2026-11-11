import { notFound } from "next/navigation";
import { categories } from "@/catalog";
import { NEED_LABELS } from "@/engine/needs";
import { CATALOG_YEAR, allPairs, breadcrumbLd, categoryBySlug, money, pageMeta, recipesUsing, toolsIn } from "@/seo";
import { SITE_URL } from "@/site";
import type { CategorySlug, Need } from "@/catalog";
import { SiteFooter, SiteHeader } from "../../_components/chrome";
import { GuideCta } from "../../_components/guide-cta";
import { Crumbs, JsonLd } from "../../_components/json-ld";

export const dynamicParams = false;

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const c = categoryBySlug.get((await params).slug as CategorySlug);
  if (!c) return {};
  const list = toolsIn(c.slug);
  return pageMeta({
    title: `Best ${c.name.toLowerCase()} for your app in ${CATALOG_YEAR}: ${list.map((t) => t.name).join(" vs ")}`,
    description: `${list.map((t) => t.name).join(", ")} compared: free-plan limits, starting prices, cost at 1,000 users and when to pick each. ${c.howToChoose}`.slice(0, 300),
    path: `/categories/${c.slug}`,
  });
}

/** For each need, the tool in this category with the highest published score, when one clearly leads. */
function bestByNeed(slug: CategorySlug) {
  const list = toolsIn(slug);
  const needs = new Set<Need>(list.flatMap((t) => Object.keys(t.fit) as Need[]));
  const out: { need: Need; tool: (typeof list)[number]; reason: string }[] = [];
  for (const n of needs) {
    const ranked = list.map((t) => ({ t, w: t.fit[n]?.weight ?? 0 })).sort((a, b) => b.w - a.w || a.t.baseline - b.t.baseline);
    if (ranked[0].w > 0 && (ranked.length === 1 || ranked[0].w > ranked[1].w)) out.push({ need: n, tool: ranked[0].t, reason: ranked[0].t.fit[n]!.reason });
  }
  return out.sort((a, b) => NEED_LABELS[a.need].localeCompare(NEED_LABELS[b.need]));
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = categoryBySlug.get((await params).slug as CategorySlug);
  if (!c) notFound();
  const list = toolsIn(c.slug);
  const pairs = allPairs().filter((p) => p.category.slug === c.slug);
  const byNeed = bestByNeed(c.slug);
  const crumbs = [
    { name: "Cuely", path: "/" },
    { name: "Tools", path: "/tools" },
    { name: c.name, path: `/categories/${c.slug}` },
  ];
  const usedIn = [...new Map(list.flatMap((t) => recipesUsing(t.slug).filter((u) => u.role === "pick").map((u) => [u.recipe.slug, u.recipe]))).values()];

  return (
    <>
      <SiteHeader />
      <JsonLd
        data={[
          breadcrumbLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `${c.name} options`,
            itemListOrder: "https://schema.org/ItemListOrderAscending",
            itemListElement: list.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/tools/${t.slug}`, name: t.name })),
          },
        ]}
      />
      <main id="main" className="wrap guide">
        <Crumbs items={crumbs} />
        <p className="eyebrow">Category · {list.length} options</p>
        <h1 className="page-title">Choosing {c.name.toLowerCase()}</h1>
        <p className="page-lede">
          {c.description} {c.howToChoose}
        </p>

        <section className="panel" aria-labelledby="table-title">
          <div className="panel-head">
            <h2 id="table-title">Free plans and prices</h2>
            <p className="muted">In Cuely&apos;s default order for the general case. Your needs change the order; see below.</p>
          </div>
          <div className="table-scroll">
            <table className="fact-table">
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Free plan</th>
                  <th scope="col">Paid from</th>
                  <th scope="col">At 1,000 users</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.slug}>
                    <td>
                      <strong>
                        <a href={`/tools/${t.slug}`}>{t.name}</a>
                      </strong>
                      <div className="muted small">{t.pitch}</div>
                    </td>
                    <td>{t.freeTier ?? <span className="muted">None</span>}</td>
                    <td>{t.paidStartsAt ?? <span className="muted">Not stated</span>}</td>
                    <td>{money(t.cost?.monthly) ? `${money(t.cost?.monthly)}/month` : (t.cost?.variable ?? <span className="muted">—</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {byNeed.length > 0 && (
          <section className="panel" aria-labelledby="need-title">
            <div className="panel-head">
              <h2 id="need-title">Best pick by need</h2>
              <p className="muted">From the published scores Cuely ranks with. Only needs where one tool clearly leads.</p>
            </div>
            <ul className="guide-list">
              {byNeed.map((b) => (
                <li key={b.need}>
                  <strong>{NEED_LABELS[b.need]}:</strong> <a href={`/tools/${b.tool.slug}`}>{b.tool.name}</a>. {b.reason}
                </li>
              ))}
            </ul>
          </section>
        )}

        {pairs.length > 0 && (
          <section className="panel" aria-labelledby="pairs-title">
            <div className="panel-head">
              <h2 id="pairs-title">Head to head</h2>
            </div>
            <ul className="chip-list">
              {pairs.map((p) => (
                <li key={p.slug}>
                  <a href={`/compare/${p.slug}`}>
                    {p.a.name} vs {p.b.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {usedIn.length > 0 && (
          <section className="panel" aria-labelledby="used-title">
            <div className="panel-head">
              <h2 id="used-title">Recipes that use this category</h2>
            </div>
            <ul className="chip-list">
              {usedIn.map((r) => (
                <li key={r.slug}>
                  <a href={`/recipes/${r.slug}`}>{r.title}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <GuideCta prompt={`Use Cuely to pick the ${c.name.toLowerCase()} for what I'm building, and tell me why.`} />
      </main>
      <SiteFooter />
    </>
  );
}
