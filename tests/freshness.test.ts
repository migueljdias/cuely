import { describe, expect, it } from "vitest";
import { diffLines, dollarAmounts, htmlToLines, missingAmounts, priceLines } from "@/freshness/pricing";

const PAGE = `<!doctype html><html><head><title>Pricing $999</title><style>.a{width:10px}</style></head>
<body>
  <script>window.__DATA__ = {"price":"$500"}</script>
  <nav><a href="/">Home</a><a href="/docs">Docs</a></nav>
  <h1>Simple pricing</h1>
  <div class="plan"><h2>Hobby</h2><p><span>$</span><span>0</span>/month</p>
    <ul><li>100,000 requests per day</li><li>3,000 emails per month</li><li>Community support</li></ul></div>
  <div class="plan"><h2>Pro</h2><p><span>$</span><span>20</span><small>/month</small></p>
    <ul><li>10M requests included, then $0.30 per million</li><li>5&nbsp;GB storage</li><li>2.9% + 30&cent; per charge</li>
    <li>100,000 requests per day</li></ul></div>
  <!-- <p>$77 hidden</p> -->
  <footer>&copy; 2026 Example, Inc. All rights reserved.</footer>
</body></html>`;

describe("pricing page reading", () => {
  it("turns HTML into visible lines, joining inline tags and dropping scripts, styles and comments", () => {
    const lines = htmlToLines(PAGE);
    expect(lines).toContain("$0/month");
    expect(lines).toContain("$20/month");
    expect(lines).toContain("5 GB storage");
    expect(lines.join("\n")).not.toMatch(/\$500|\$999|\$77|width/);
  });

  it("keeps only lines that state a price or a limit, once each, in page order", () => {
    expect(priceLines(PAGE)).toEqual([
      "$0/month",
      "100,000 requests per day",
      "3,000 emails per month",
      "$20/month",
      "10M requests included, then $0.30 per million",
      "5 GB storage",
      "2.9% + 30¢ per charge",
    ]);
  });

  it("reports added and removed lines and ignores reordering", () => {
    const before = ["$0/month", "$20/month", "5 GB storage"];
    expect(diffLines(before, ["5 GB storage", "$0/month", "$25/month"])).toEqual({ added: ["$25/month"], removed: ["$20/month"] });
    expect(diffLines(before, [...before].reverse())).toEqual({ added: [], removed: [] });
  });

  it("normalizes dollar amounts", () => {
    expect(dollarAmounts("Pro: $20.00/month, $1,000 credit, then $0.106 per hour and $ 5 more; $20 again")).toEqual(["$20", "$1000", "$0.106", "$5"]);
  });

  it("finds amounts the catalog quotes that the page no longer shows", () => {
    expect(missingAmounts(["Hobby, $0/month: 100,000 requests", "Pro: $20/month, then $0.30 per million"], PAGE)).toEqual([]);
    expect(missingAmounts(["Free", "Pro: $25/month, including $20 of usage"], PAGE)).toEqual(["$25"]);
    expect(missingAmounts([null, null], PAGE)).toEqual([]);
  });
});
