/** Structured data for search engines. `<` is escaped so catalog text can't close the script tag. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
  );
}

/** Home > Section > Page trail, visible and matching the BreadcrumbList data. */
export function Crumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((it, i) => (
          <li key={it.path}>{i === items.length - 1 ? <span aria-current="page">{it.name}</span> : <a href={it.path}>{it.name}</a>}</li>
        ))}
      </ol>
    </nav>
  );
}
