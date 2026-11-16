import { categories, tools } from "@/catalog";
import { CATALOG_YEAR, breadcrumbLd, pageMeta, toolsIn } from "@/seo";
import { SiteFooter, SiteHeader } from "../_components/chrome";
import { GuideCta } from "../_components/guide-cta";
import { ToolLogo } from "../_components/tool-logo";
import { Crumbs, JsonLd } from "../_components/json-ld";

export const metadata = pageMeta({
  title: `Developer tools compared (${CATALOG_YEAR}): free plans, prices and catches`,
  description: `${tools.length} hosting, database, auth, payments, email and AI tools across ${categories.length} categories, with each free plan's real limits read from the vendor's own pricing page. No paid placement.`,
  path: "/tools",
});

export default function Tools() {
  const crumbs = [
    { name: "Cuely", path: "/" },
    { name: "Tools", path: "/tools" },
  ];
  return (
    <>
      <SiteHeader />
      <JsonLd data={breadcrumbLd(crumbs)} />
      <main id="main" className="wrap guide">
        <Crumbs items={crumbs} />
        <h1 className="page-title">The catalog</h1>
        <p className="page-lede">
          Every tool Cuely weighs, by category. Free plans and prices come from each vendor&apos;s own pricing page, with
          the date it was read. No vendor pays to be here, and there are no affiliate links.
        </p>
        <div className="cat-grid">
          {[...categories]
            .sort((a, b) => a.order - b.order)
            .map((c) => (
              <section key={c.slug} className="card" aria-labelledby={`cat-${c.slug}`}>
                <h2 id={`cat-${c.slug}`}>
                  <a href={`/categories/${c.slug}`}>{c.name}</a>
                </h2>
                <p className="muted small">{c.description}</p>
                <ul className="plain">
                  {toolsIn(c.slug).map((t) => (
                    <li key={t.slug}>
                      <a className="with-logo" href={`/tools/${t.slug}`}>
                        <ToolLogo slug={t.slug} name={t.name} size={18} />
                        {t.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
        <GuideCta prompt="Use Cuely to choose the stack for what I'm building." />
      </main>
      <SiteFooter />
    </>
  );
}
