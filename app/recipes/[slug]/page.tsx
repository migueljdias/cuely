import { notFound } from "next/navigation";
import { COST_PROFILE, recipes, tools } from "@/catalog";
import { recipeCost } from "@/mcp/render";
import { CATALOG_YEAR, breadcrumbLd, categoryBySlug, formatDate, pageMeta, toolBySlug } from "@/seo";
import { SITE_URL } from "@/site";
import { SiteFooter, SiteHeader } from "../../_components/chrome";
import { GuideCta } from "../../_components/guide-cta";
import { Crumbs, JsonLd } from "../../_components/json-ld";

export const dynamicParams = false;

export function generateStaticParams() {
  return recipes.map((r) => ({ slug: r.slug }));
}

function find(slug: string) {
  return recipes.find((r) => r.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const r = find((await params).slug);
  if (!r) return {};
  const picks = r.stack.filter((s) => !s.optional).map((s) => toolBySlug.get(s.tool)?.name ?? s.tool);
  return pageMeta({
    title: `How to build a ${r.title.charAt(0).toLowerCase()}${r.title.slice(1)}: stack and setup (${CATALOG_YEAR})`,
    description: `${r.summary.split(". ")[0]}. Stack: ${picks.slice(0, 5).join(", ")}. ${r.steps.length} steps with free-plan limits and costs.`.slice(0, 300),
    path: `/recipes/${r.slug}`,
  });
}

const toolLink = (slug: string) => {
  const t = toolBySlug.get(slug);
  return t ? <a href={`/tools/${t.slug}`}>{t.name}</a> : <>{slug}</>;
};

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const r = find((await params).slug);
  if (!r) notFound();
  const crumbs = [
    { name: "Cuely", path: "/" },
    { name: "Recipes", path: "/recipes" },
    { name: r.title, path: `/recipes/${r.slug}` },
  ];
  const cost = recipeCost(r, tools);
  const total = cost?.match(/^About (\$[\d.,]+)\/month (at [\d,]+ users|for \d+ staff)/);

  return (
    <>
      <SiteHeader />
      <JsonLd
        data={[
          breadcrumbLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: `How to build a ${r.title.toLowerCase()}`,
            description: r.summary,
            dateModified: r.verifiedOn,
            tool: r.stack.map((s) => ({ "@type": "HowToTool", name: toolBySlug.get(s.tool)?.name ?? s.tool })),
            step: r.steps.map((s, i) => ({
              "@type": "HowToStep",
              position: i + 1,
              name: s.title,
              text: [s.detail, ...s.actions].join(" "),
              url: `${SITE_URL}/recipes/${r.slug}#step-${i + 1}`,
            })),
          },
        ]}
      />
      <main id="main" className="wrap guide">
        <Crumbs items={crumbs} />
        <p className="eyebrow">Recipe · checked {formatDate(r.verifiedOn)}</p>
        <h1 className="page-title">{r.title}</h1>
        <p className="page-lede">{r.summary}</p>

        <div className="fact-row">
          {total && (
            <div>
              <span className="muted small">Tool bills {total[2]}</span>
              <strong>About {total[1]}/month</strong>
            </div>
          )}
          <div>
            <span className="muted small">Setup steps</span>
            <strong>{r.steps.length}</strong>
          </div>
          <div>
            <span className="muted small">Tools in the stack</span>
            <strong>{r.stack.length}</strong>
          </div>
        </div>

        <div className="two-col">
          <section aria-labelledby="fits-title">
            <h2 id="fits-title">Fits when</h2>
            <ul className="guide-list">
              {r.fitsWhen.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="not-title">
            <h2 id="not-title">Not for</h2>
            <ul className="guide-list">
              {r.notFor.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>
        </div>

        <section className="panel" aria-labelledby="stack-title">
          <div className="panel-head">
            <h2 id="stack-title">The stack</h2>
          </div>
          <div className="table-scroll">
          <table className="fact-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Pick</th>
                <th scope="col">Why</th>
                <th scope="col">Pick something else when</th>
              </tr>
            </thead>
            <tbody>
              {r.stack.map((s) => {
                const cat = categoryBySlug.get(s.category);
                return (
                  <tr key={`${s.category}-${s.tool}`}>
                    <td>
                      {cat ? <a href={`/categories/${cat.slug}`}>{cat.name}</a> : s.category}
                      {s.optional && <span className="tag">optional</span>}
                    </td>
                    <td>
                      <strong>{toolLink(s.tool)}</strong>
                    </td>
                    <td>{s.why}</td>
                    <td>
                      {s.alternatives.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <ul className="plain">
                          {s.alternatives.map((a) => (
                            <li key={a.tool}>
                              {toolLink(a.tool)}: {a.when}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {cost && (
            <p className="muted small">
              {cost} Usage profile: {COST_PROFILE.text}
            </p>
          )}
        </section>

        {r.catches && r.catches.length > 0 && (
          <section className="panel" aria-labelledby="catches-title">
            <div className="panel-head">
              <h2 id="catches-title">Catches that change the plan</h2>
            </div>
            <ul className="guide-list">
              {r.catches.map((c) => (
                <li key={c.text}>
                  {c.text}{" "}
                  <a className="muted small" href={c.source} rel="nofollow noopener" target="_blank">
                    Source
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel" aria-labelledby="steps-title">
          <div className="panel-head">
            <h2 id="steps-title">Setup steps</h2>
          </div>
          <ol className="recipe-steps">
            {r.steps.map((s, i) => (
              <li key={s.title} id={`step-${i + 1}`}>
                <h3>{s.title}</h3>
                <p>{s.detail}</p>
                <ul className="guide-list">
                  {s.actions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                {s.commands && s.commands.length > 0 && (
                  <pre className="snippet">
                    <code>{s.commands.join("\n")}</code>
                  </pre>
                )}
                {s.files?.map((f) => (
                  <details key={f.path} className="file">
                    <summary>
                      <code>{f.path}</code>
                    </summary>
                    <pre className="snippet">
                      <code>{f.contents}</code>
                    </pre>
                  </details>
                ))}
                <p className="check">
                  <strong>Done when:</strong> {s.check}
                </p>
                {s.docs && s.docs.length > 0 && (
                  <p className="muted small">
                    Docs:{" "}
                    {s.docs.map((d, j) => (
                      <span key={d}>
                        {j > 0 && ", "}
                        <a href={d} rel="nofollow noopener" target="_blank">
                          {new URL(d).hostname.replace(/^www\./, "")}
                        </a>
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>

        <div className="two-col">
          <section aria-labelledby="best-title">
            <h2 id="best-title">Best practices</h2>
            <ul className="guide-list">
              {r.bestPractices.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="pit-title">
            <h2 id="pit-title">Pitfalls</h2>
            <ul className="guide-list">
              {r.pitfalls.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        </div>

        {(r.costNotes?.length || r.complianceNotes.length) > 0 && (
          <section className="panel" aria-labelledby="notes-title">
            <div className="panel-head">
              <h2 id="notes-title">Costs and obligations</h2>
            </div>
            <ul className="guide-list">
              {(r.costNotes ?? []).map((c) => (
                <li key={c}>{c}</li>
              ))}
              {r.complianceNotes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="muted small">These point to obligations to check; they aren&apos;t legal or tax advice.</p>
          </section>
        )}

        <GuideCta prompt={`Use Cuely to get the setup recipe for a ${r.title.toLowerCase()}, adjusted for what I already use.`} />
      </main>
      <SiteFooter />
    </>
  );
}
