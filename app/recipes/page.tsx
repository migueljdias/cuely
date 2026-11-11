import { recipes } from "@/catalog";
import { CATALOG_YEAR, breadcrumbLd, pageMeta, toolBySlug } from "@/seo";
import { SITE_URL } from "@/site";
import { SiteFooter, SiteHeader } from "../_components/chrome";
import { GuideCta } from "../_components/guide-cta";
import { Crumbs, JsonLd } from "../_components/json-ld";

export const metadata = pageMeta({
  title: `Tech stack recipes for ${CATALOG_YEAR}: SaaS, marketplace, AI and mobile apps`,
  description: `${recipes.length} step-by-step build recipes with the stack, real free-plan limits, monthly cost at 1,000 users and the catches to plan for. No paid placement.`,
  path: "/recipes",
});

export default function Recipes() {
  const crumbs = [
    { name: "Cuely", path: "/" },
    { name: "Recipes", path: "/recipes" },
  ];
  return (
    <>
      <SiteHeader />
      <JsonLd
        data={[
          breadcrumbLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: recipes.map((r, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/recipes/${r.slug}`, name: r.title })),
          },
        ]}
      />
      <main id="main" className="wrap guide">
        <Crumbs items={crumbs} />
        <h1 className="page-title">Stack recipes</h1>
        <p className="page-lede">
          A recipe is the whole build for one kind of product: the tools, the order to set them up, starter files, and the
          facts that change the plan. Your agent gets the same recipe from Cuely&apos;s <code>get_recipe</code> tool.
        </p>
        <ul className="card-grid">
          {recipes.map((r) => (
            <li key={r.slug} className="card">
              <h2>
                <a href={`/recipes/${r.slug}`}>{r.title}</a>
              </h2>
              <p>{r.summary}</p>
              <p className="muted small">
                {r.stack
                  .filter((s) => !s.optional)
                  .map((s) => toolBySlug.get(s.tool)?.name ?? s.tool)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
        <GuideCta prompt="Use Cuely to choose the stack for what I'm building, and give me the setup recipe." />
      </main>
      <SiteFooter />
    </>
  );
}
