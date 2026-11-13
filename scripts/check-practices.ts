/**
 * Loads every source page the start_project checklist cites (src/catalog/practices.ts)
 * every catch's source, and every source and docs link in the recipes, and fails when one no longer loads, so a moved or deleted
 * page is fixed instead of cited.
 *
 * Usage: npx tsx scripts/check-practices.ts
 */
import { CATCHES, recipes } from "@/catalog";
import { PRACTICES } from "@/catalog/practices";

const USER_AGENT = "Mozilla/5.0 (compatible; CuelyFreshness/1.0; +https://cuely.dev)";
const recipeUrls = recipes.flatMap((r) => [...(r.catches ?? []).map((c) => c.source), ...r.steps.flatMap((s) => s.docs ?? [])]);
const urls = [...new Set([...PRACTICES.map((p) => p.source), ...CATCHES.map((c) => c.source), ...recipeUrls])];

async function load(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(25_000) });
      // Some sites refuse automated readers (403/429) while the page exists; that isn't a broken link.
      if (res.ok || res.status === 403 || res.status === 429) return null;
      if (res.status === 404 || res.status === 410) return `HTTP ${res.status}`;
      if (attempt) return `HTTP ${res.status}`;
    } catch (e) {
      if (attempt) return e instanceof Error ? e.message : String(e);
    }
  }
  return null;
}

const results = await Promise.all(urls.map(async (u) => [u, await load(u)] as const));
const broken = results.filter(([, err]) => err);
for (const [u, err] of results) console.log(`${err ? "BROKEN" : "ok    "} ${u}${err ? ` (${err})` : ""}`);
console.log(`\n${urls.length} pages, ${broken.length} broken.`);
if (broken.length) process.exit(1);
