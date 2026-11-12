/**
 * Pricing-page freshness: reads a vendor's pricing page, keeps only the lines that
 * state a price or a limit, and compares them with the last read.
 *
 * This never edits the catalog. It says which pages changed and which amounts the
 * catalog quotes that the page no longer shows; src/freshness/facts.ts takes it
 * from there.
 *
 * Pure functions only, so they can be tested without the network
 * (scripts/check-pricing.ts does the fetching and writes the snapshots).
 */

/** What is stored per tool under data/pricing/<slug>.json. */
export interface PricingSnapshot {
  slug: string;
  url: string;
  /** Date (YYYY-MM-DD) the lines below were last seen to change. */
  readOn: string;
  /** The page's price and limit lines, in page order, without duplicates. */
  lines: string[];
}

export interface PricingDiff {
  added: string[];
  removed: string[];
}

const BLOCK_TAGS =
  "address|article|aside|blockquote|br|button|caption|dd|details|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul";

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", dollar: "$", euro: "€", pound: "£", cent: "¢",
  percnt: "%", ndash: "–", mdash: "—", times: "×", plus: "+", comma: ",", period: ".", sol: "/",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Visible text of an HTML page, one line per block element. Inline tags are removed
 * without a space, so "<span>$</span><span>20</span>" reads "$20".
 */
export function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1\s*>/gi, "\n")
    .replace(new RegExp(`<\\/?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[\s ​]+/g, " ").trim())
    .filter(Boolean);
}

const UNITS =
  "requests?|emails?|users?|seats?|members?|projects?|events?|hours?|minutes?|days?|builds?|credits?|tokens?|rows?|records?|domains?|environments?|identities|organizations?|connections?|messages?|invocations?|databases?|branches|apps?|sessions?|recordings?|replays?|errors?|spans|monitors?|operations?|reads?|writes?|commands?|vectors?|updates?";
const PRICE_OR_LIMIT = new RegExp(
  [
    "[$€£]\\s?\\d", // $20, € 5
    "\\d\\s?[¢%]", // 30¢, 2.9%
    "\\b\\d[\\d,.]*\\s?(?:[kmb]\\b|gb\\b|mb\\b|tb\\b|million\\b|billion\\b|thousand\\b)", // 100k, 5 GB, 1 million
    `\\b\\d[\\d,.]*\\+?\\s(?:[a-z-]+\\s){0,2}(?:${UNITS})\\b`, // 3,000 emails, 50 session replays
  ].join("|"),
  "i",
);

const MAX_LINE = 300;

/** The lines of a page that state a price or a limit, in page order, without duplicates. */
export function priceLines(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of htmlToLines(html)) {
    if (!PRICE_OR_LIMIT.test(line)) continue;
    const kept = line.length > MAX_LINE ? `${line.slice(0, MAX_LINE)}…` : line;
    if (seen.has(kept)) continue;
    seen.add(kept);
    out.push(kept);
  }
  return out;
}

/** Fewer price lines than this means the page didn't render for a plain fetch (or blocked it). */
export const MIN_READABLE_LINES = 3;

export function diffLines(before: string[], after: string[]): PricingDiff {
  const b = new Set(before);
  const a = new Set(after);
  return { added: after.filter((l) => !b.has(l)), removed: before.filter((l) => !a.has(l)) };
}

/** "$1,000.00" and "$1000" are the same amount; "$0.106" stays as written. */
function normalizeAmount(raw: string): string {
  const n = raw.replace(/[\s,]/g, "");
  return n.includes(".") ? n.replace(/0+$/, "").replace(/\.$/, "") : n;
}

/** Every dollar amount in a piece of text, normalized, without duplicates. */
export function dollarAmounts(text: string): string[] {
  const found = text.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) ?? [];
  return [...new Set(found.map(normalizeAmount))];
}

/**
 * Dollar amounts the catalog quotes for a tool (free plan and cheapest paid plan)
 * that no longer appear anywhere on its pricing page. An empty list means every
 * quoted amount is still on the page; it doesn't prove the sentence around it is.
 */
export function missingAmounts(claims: (string | null)[], html: string): string[] {
  const onPage = new Set(dollarAmounts(htmlToLines(html).join("\n")));
  const claimed = dollarAmounts(claims.filter((c): c is string => !!c).join("\n"));
  return claimed.filter((amount) => !onPage.has(amount));
}
