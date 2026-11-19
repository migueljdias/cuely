import type { Metadata } from "next";
import { categories, recipes, tools, type Category, type CategorySlug, type Recipe, type Tool } from "@/catalog";
import { SITE_URL } from "@/site";

/**
 * The public, crawlable pages built from the catalog: one per recipe, category, tool and
 * same-category pair. Every fact on them comes from src/catalog, so they can't drift from
 * what the MCP server answers.
 */

export const SITE_NAME = "Cuely";

/** Year shown in titles, from the newest catalog check, so titles never claim a year the facts weren't read in. */
export const CATALOG_YEAR = [...tools.map((t) => t.verifiedOn), ...recipes.map((r) => r.verifiedOn)].sort().at(-1)!.slice(0, 4);

export const toolBySlug = new Map(tools.map((t) => [t.slug, t]));
export const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

export function toolsIn(slug: CategorySlug): Tool[] {
  return tools.filter((t) => t.category === slug).sort((a, b) => a.baseline - b.baseline || a.name.localeCompare(b.name));
}

/** Recipes whose stack names this tool, as the pick or as an alternative. */
export function recipesUsing(slug: string): { recipe: Recipe; role: "pick" | "alternative" }[] {
  const out: { recipe: Recipe; role: "pick" | "alternative" }[] = [];
  for (const r of recipes) {
    if (r.stack.some((s) => s.tool === slug)) out.push({ recipe: r, role: "pick" });
    else if (r.stack.some((s) => s.alternatives.some((a) => a.tool === slug))) out.push({ recipe: r, role: "alternative" });
  }
  return out;
}

/** One canonical URL per pair: slugs in alphabetical order, joined by -vs-. */
export function pairSlug(a: string, b: string): string {
  return [a, b].sort().join("-vs-");
}

export function parsePair(pair: string): [Tool, Tool] | null {
  const parts = pair.split("-vs-");
  if (parts.length !== 2) return null;
  const a = toolBySlug.get(parts[0]);
  const b = toolBySlug.get(parts[1]);
  if (!a || !b || a.slug === b.slug || a.category !== b.category) return null;
  return pairSlug(a.slug, b.slug) === pair ? [a, b] : null;
}

/** Every same-category pair, in canonical order. */
export function allPairs(): { slug: string; a: Tool; b: Tool; category: Category }[] {
  const out: { slug: string; a: Tool; b: Tool; category: Category }[] = [];
  for (const c of categories) {
    const list = toolsIn(c.slug);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]].sort((x, y) => x.slug.localeCompare(y.slug));
        out.push({ slug: pairSlug(a.slug, b.slug), a, b, category: c });
      }
    }
  }
  return out;
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function money(n: number | null | undefined): string | null {
  if (n == null) return null;
  return n === 0 ? "$0" : `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Title, description, canonical, Open Graph and X card for one page, all consistent. */
export function pageMeta({ title, description, path, index = true }: { title: string; description: string; path: string; index?: boolean }): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website", images: ["/opengraph-image.png"] },
    twitter: { card: "summary_large_image", title, description, images: ["/twitter-image.png"] },
    ...(index ? {} : { robots: { index: false, follow: true } }),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE_URL}${it.path}` })),
  };
}

/** Every public page, for the sitemap. */
export function publicPaths(): { path: string; lastModified?: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] {
  const latest = (dates: string[]) => dates.sort().at(-1);
  return [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/start", priority: 0.9, changeFrequency: "monthly" },
    { path: "/recipes", priority: 0.8, changeFrequency: "weekly", lastModified: latest(recipes.map((r) => r.verifiedOn)) },
    ...recipes.map((r) => ({ path: `/recipes/${r.slug}`, priority: 0.8, changeFrequency: "monthly" as const, lastModified: r.verifiedOn })),
    { path: "/tools", priority: 0.8, changeFrequency: "weekly", lastModified: latest(tools.map((t) => t.verifiedOn)) },
    ...categories.map((c) => ({
      path: `/categories/${c.slug}`,
      priority: 0.7,
      changeFrequency: "monthly" as const,
      lastModified: latest(toolsIn(c.slug).map((t) => t.verifiedOn)),
    })),
    ...tools.map((t) => ({ path: `/tools/${t.slug}`, priority: 0.6, changeFrequency: "monthly" as const, lastModified: t.verifiedOn })),
    ...allPairs().map((p) => ({
      path: `/compare/${p.slug}`,
      priority: 0.5,
      changeFrequency: "monthly" as const,
      lastModified: latest([p.a.verifiedOn, p.b.verifiedOn]),
    })),
    { path: "/pricing", priority: 0.5, changeFrequency: "monthly" },
    { path: "/llms.txt", priority: 0.4, changeFrequency: "weekly" },
    { path: "/trust", priority: 0.4, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  ];
}
