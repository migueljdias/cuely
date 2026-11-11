import { notFound } from "next/navigation";
import { categories, recipes, tools } from "@/catalog";
import { compareTools } from "@/engine/compare";
import { NEED_SHORT } from "@/engine/needs";
import { CATALOG_YEAR, allPairs, breadcrumbLd, categoryBySlug, formatDate, money, pageMeta, parsePair, toolsIn, pairSlug } from "@/seo";
import { SiteFooter, SiteHeader } from "../../_components/chrome";
import { GuideCta } from "../../_components/guide-cta";
import { Crumbs, JsonLd } from "../../_components/json-ld";

export const dynamicParams = false;

export function generateStaticParams() {
  return allPairs().map((p) => ({ pair: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ pair: string }> }) {
  const pair = parsePair((await params).pair);
  if (!pair) return {};
  const [a, b] = pair;
  const cat = categoryBySlug.get(a.category)!;
  return pageMeta({
    title: `${a.name} vs ${b.name} (${CATALOG_YEAR}): free plans, pricing and which to pick`,
    description: `${a.name} vs ${b.name} for ${cat.name.toLowerCase()}: free-plan limits, starting prices, cost at 1,000 users and when each one wins, from published rules with no paid placement.`,
    path: `/compare/${pairSlug(a.slug, b.slug)}`,
  });
}

const sc = (w: number) => (w > 0 ? `+${w}` : w < 0 ? `−${Math.abs(w)}` : "0");

export default async function ComparePage({ params }: { params: Promise<{ pair: string }> }) {
  const pair = parsePair((await params).pair);
  if (!pair) notFound();
  const [a, b] = pair;
  const cat = categoryBySlug.get(a.category)!;
  const result = compareTools({ categories, tools, recipes }, { a: a.slug, b: b.slug });
  if (!result.ok) notFound();
  const path = `/compare/${pairSlug(a.slug, b.slug)}`;
  const crumbs = [
    { name: "Cuely", path: "/" },
    { name: cat.name, path: `/categories/${cat.slug}` },
    { name: `${a.name} vs ${b.name}`, path },
  ];
  const others = toolsIn(cat.slug).filter((t) => t.slug !== a.slug && t.slug !== b.slug);
  const rows: { label: string; a: React.ReactNode; b: React.ReactNode }[] = [
    { label: "What it is", a: a.summary, b: b.summary },
    { label: "Free plan", a: a.freeTier ?? "None", b: b.freeTier ?? "None" },
    { label: "Paid from", a: a.paidStartsAt ?? "Not stated", b: b.paidStartsAt ?? "Not stated" },
    {
      label: "At 1,000 users",
      a: money(a.cost?.monthly) ? `${money(a.cost?.monthly)}/month` : (a.cost?.variable ?? "—"),
      b: money(b.cost?.monthly) ? `${money(b.cost?.monthly)}/month` : (b.cost?.variable ?? "—"),
    },
    { label: "Open source", a: a.openSource ? "Yes" : "No", b: b.openSource ? "Yes" : "No" },
    { label: "Self-hostable", a: a.selfHostable ? "Yes" : "No", b: b.selfHostable ? "Yes" : "No" },
    { label: "Best for", a: a.bestFor.join("; "), b: b.bestFor.join("; ") },
    { label: "Watch out", a: a.watchOut.join(" "), b: b.watchOut.join(" ") },
  ];
  // The no-context default, plus when the other one wins, so the answer is useful without an agent.
  const def = result.verdict.startsWith(`With no context, ${a.name} is`) ? a : b;
  const other = def === a ? b : a;
  const edge = result.differences.find((d) => (other === a ? d.a.weight > d.b.weight : d.b.weight > d.a.weight));
  const verdict = `${def.name} is Cuely's default ${cat.name.toLowerCase()} pick when your description doesn't favor either one: ${def.pitch.charAt(0).toLowerCase()}${def.pitch.slice(1)}${
    edge ? ` Pick ${other.name} if you care most about ${NEED_SHORT[edge.need]}.` : ""
  }`;
  const faq = [
    { q: `Which is better, ${a.name} or ${b.name}?`, a: verdict },
    ...result.differences.slice(0, 4).map((d) => {
      const win = d.a.weight > d.b.weight ? a : b;
      return { q: `${a.name} or ${b.name} for ${d.label.toLowerCase()}?`, a: `${win.name}. ${(win === a ? d.a : d.b).reason}` };
    }),
  ];

  return (
    <>
      <SiteHeader />
      <JsonLd
        data={[
          breadcrumbLd(crumbs),
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ]}
      />
      <main id="main" className="wrap guide">
        <Crumbs items={crumbs} />
        <p className="eyebrow">Facts read {formatDate([a.verifiedOn, b.verifiedOn].sort()[0])}</p>
        <h1 className="page-title">
          {a.name} vs {b.name}
        </h1>
        <p className="page-lede">{faq[0].a}</p>

        <section className="panel" aria-labelledby="side-title">
          <div className="panel-head">
            <h2 id="side-title">Side by side</h2>
          </div>
          <div className="table-scroll">
            <table className="fact-table compare-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Fact</span>
                  </th>
                  <th scope="col">
                    <a href={`/tools/${a.slug}`}>{a.name}</a>
                  </th>
                  <th scope="col">
                    <a href={`/tools/${b.slug}`}>{b.name}</a>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td>{r.a}</td>
                    <td>{r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {result.differences.length > 0 && (
          <section className="panel" aria-labelledby="diff-title">
            <div className="panel-head">
              <h2 id="diff-title">Where they differ</h2>
              <p className="muted">The published scores, from −3 to +3, that decide which one Cuely picks for each need.</p>
            </div>
            <div className="table-scroll">
              <table className="fact-table">
                <thead>
                  <tr>
                    <th scope="col">Need</th>
                    <th scope="col">{a.name}</th>
                    <th scope="col">{b.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.differences.map((d) => (
                    <tr key={d.need}>
                      <th scope="row">{d.label}</th>
                      <td className={d.a.weight > d.b.weight ? "win" : undefined}>
                        <span className="score-num">{sc(d.a.weight)}</span> {d.a.reason}
                      </td>
                      <td className={d.b.weight > d.a.weight ? "win" : undefined}>
                        <span className="score-num">{sc(d.b.weight)}</span> {d.b.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="muted small">
          Sources: <a href={a.pricingUrl} rel="nofollow noopener" target="_blank">{a.name} pricing</a> (read {formatDate(a.verifiedOn)}),{" "}
          <a href={b.pricingUrl} rel="nofollow noopener" target="_blank">{b.name} pricing</a> (read {formatDate(b.verifiedOn)}). No vendor
          pays for placement.
        </p>

        {others.length > 0 && (
          <section className="panel" aria-labelledby="more-title">
            <div className="panel-head">
              <h2 id="more-title">Other {cat.name.toLowerCase()} options</h2>
            </div>
            <ul className="chip-list">
              {others.map((o) => (
                <li key={o.slug}>
                  <a href={`/tools/${o.slug}`}>{o.name}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <GuideCta prompt={`Use Cuely to compare ${a.name} and ${b.name} for what I'm building.`} />
      </main>
      <SiteFooter />
    </>
  );
}
