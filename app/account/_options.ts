import type { CatalogSnapshot } from "@/engine/recommend";
import type { ToolOption } from "./_tool-picker";

/** Every catalog tool as a picker option, by name. */
export function toolOptions(snap: CatalogSnapshot): ToolOption[] {
  const cat = new Map(snap.categories.map((c) => [c.slug, c.name]));
  return snap.tools.map((t) => ({ slug: t.slug, name: t.name, category: cat.get(t.category) ?? t.category })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Fact text without the bare source URLs in brackets that agents get; the page links sources itself. */
export function plain(text: string): string {
  return text.replace(/\s*\(https?:\/\/[^)\s]+\)/g, "");
}
