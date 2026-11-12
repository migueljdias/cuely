import { describe, expect, it } from "vitest";
import { categories, recipes, tools } from "@/catalog";
import type { Tool, ToolCompliance } from "@/catalog";
import { COMPLIANCE_SOURCES } from "@/catalog/compliance-sources";
import { detectNeeds } from "@/engine/needs";
import { recommendStack, scoreTool } from "@/engine/recommend";
import {
  DATA_CATEGORIES, complianceFor, complianceLines, decideCompliance, samePages, statedCompliance, type ComplianceProposal, type TopicAnswer,
} from "@/freshness/compliance";
import { renderRecommendation } from "@/mcp/render";

const HIPAA_URL = "https://vendor.example/hipaa";
const REGIONS_URL = "https://vendor.example/regions";
const pages = [
  { url: HIPAA_URL, lines: ["We sign a Business Associate Agreement (BAA) with customers on the Team plan and above.", "Vendor is SOC 2 Type II compliant."] },
  { url: REGIONS_URL, lines: ["Choose a region: Frankfurt (eu-central-1), London, North Virginia."] },
];
const unstated: TopicAnswer = { answer: "unstated", detail: "", quote: "", source: "" };
const proposal = (over: Partial<ComplianceProposal>): ComplianceProposal => ({ baa: unstated, dpa: unstated, eu_region: unstated, soc2: unstated, ...over });
const baaPlan: TopicAnswer = { answer: "plan", detail: "Team plan and above", quote: "We sign a Business Associate Agreement (BAA) with customers on the Team plan", source: HIPAA_URL };

describe("Reading compliance pages", () => {
  it("keeps only the lines about these topics, once each", () => {
    const html = `<main><h1>Security</h1><p>We love our customers.</p><li>SOC 2 Type II report available</li><li>SOC 2 Type II report available</li>
      <p>Sign our <b>Data Processing</b> Addendum online.</p><p>Data is stored in Frankfurt.</p><script>var hipaa = 1;</script></main>`;
    expect(complianceLines(html)).toEqual(["SOC 2 Type II report available", "Sign our Data Processing Addendum online.", "Data is stored in Frankfurt."]);
  });

  it("knows when the pages are the same as last time", () => {
    expect(samePages(pages, structuredClone(pages))).toBe(true);
    expect(samePages(pages, [pages[0]])).toBe(false);
    expect(samePages(undefined, pages)).toBe(false);
  });

  it("lists pages only for tools that are in the catalog and hold user data", () => {
    for (const [slug, urls] of Object.entries(COMPLIANCE_SOURCES)) {
      const tool = tools.find((t) => t.slug === slug);
      expect(tool, slug).toBeDefined();
      expect(DATA_CATEGORIES.has(tool!.category), slug).toBe(true);
      expect(urls.length, slug).toBeGreaterThan(0);
      for (const u of urls) expect(u, slug).toMatch(/^https:\/\//);
    }
  });
});

describe("Deciding what to publish", () => {
  it("publishes an answer whose quote is on the page and about the topic", () => {
    const d = decideCompliance(undefined, proposal({ baa: baaPlan }), pages, "2026-11-12");
    expect(d.compliance).toEqual({ readOn: "2026-11-12", facts: { baa: { answer: "plan", detail: "Team plan and above", quote: baaPlan.quote, source: HIPAA_URL } } });
    expect(d.changed).toHaveLength(1);
    expect(d.held).toEqual([]);
  });

  it("matches the quote whatever the spacing and case", () => {
    const d = decideCompliance(undefined, proposal({ soc2: { answer: "yes", detail: "Type II", quote: "vendor is  SOC 2 type II compliant", source: HIPAA_URL } }), pages, "2026-11-12");
    expect(d.compliance.facts.soc2?.answer).toBe("yes");
  });

  it("holds an answer whose quote isn't on the page it names", () => {
    const made = decideCompliance(undefined, proposal({ baa: { ...baaPlan, quote: "We sign a BAA with every customer on every plan" } }), pages, "2026-11-12");
    expect(made.compliance.facts.baa).toBeUndefined();
    expect(made.held[0]).toContain("isn't on");
    const wrongPage = decideCompliance(undefined, proposal({ baa: { ...baaPlan, source: REGIONS_URL } }), pages, "2026-11-12");
    expect(wrongPage.compliance.facts.baa).toBeUndefined();
    const noPage = decideCompliance(undefined, proposal({ baa: { ...baaPlan, source: "https://elsewhere.example" } }), pages, "2026-11-12");
    expect(noPage.held[0]).toContain("isn't one of the pages read");
  });

  it("holds a quote that is on the page but about something else, or too short to mean anything", () => {
    const offTopic = decideCompliance(undefined, proposal({ baa: { ...baaPlan, quote: "Vendor is SOC 2 Type II compliant." } }), pages, "2026-11-12");
    expect(offTopic.compliance.facts.baa).toBeUndefined();
    expect(offTopic.held[0]).toContain("doesn't mention it");
    const short = decideCompliance(undefined, proposal({ soc2: { answer: "yes", detail: "", quote: "SOC 2", source: HIPAA_URL } }), pages, "2026-11-12");
    expect(short.compliance.facts.soc2).toBeUndefined();
  });

  it("keeps the published fact when a new answer is held", () => {
    const current: ToolCompliance = { readOn: "2026-11-05", facts: { baa: { answer: "plan", detail: "Team plan", quote: "old", source: HIPAA_URL } } };
    const d = decideCompliance(current, proposal({ baa: { ...baaPlan, quote: "We sign a BAA with everyone, promise" } }), pages, "2026-11-12");
    expect(d.compliance.facts.baa).toEqual(current.facts.baa);
    expect(d.compliance.readOn).toBe("2026-11-12");
  });

  it("holds a flip between offered and not offered for a person", () => {
    const current: ToolCompliance = { readOn: "2026-11-05", facts: { baa: { answer: "no", detail: "Not offered", quote: "old", source: HIPAA_URL } } };
    const d = decideCompliance(current, proposal({ baa: baaPlan }), pages, "2026-11-12");
    expect(d.compliance.facts.baa?.answer).toBe("no");
    expect(d.held[0]).toContain('published answer is "no"');
    const sameSide = decideCompliance({ readOn: "2026-11-05", facts: { baa: { ...current.facts.baa!, answer: "yes" } } }, proposal({ baa: baaPlan }), pages, "2026-11-12");
    expect(sameSide.compliance.facts.baa?.answer).toBe("plan");
    expect(sameSide.held).toEqual([]);
  });

  it("drops a fact the pages no longer state, and says so", () => {
    const current: ToolCompliance = { readOn: "2026-11-05", facts: { soc2: { answer: "yes", detail: "Type II", quote: "old", source: HIPAA_URL } } };
    const d = decideCompliance(current, proposal({}), pages, "2026-11-12");
    expect(d.compliance.facts).toEqual({});
    expect(d.changed[0]).toContain("no longer stated");
  });

  it("reports nothing when the answers match what is published", () => {
    const first = decideCompliance(undefined, proposal({ baa: baaPlan }), pages, "2026-11-05");
    const again = decideCompliance(first.compliance, proposal({ baa: baaPlan }), pages, "2026-11-12");
    expect(again.changed).toEqual([]);
    expect(again.held).toEqual([]);
  });
});

const db = (slug: string) => tools.find((t) => t.slug === slug)!;
const withBaa = (t: Tool, answer: "yes" | "plan" | "no"): Tool => ({
  ...t,
  compliance: { readOn: "2026-11-12", facts: { baa: { answer, detail: answer === "no" ? "BAAs are not offered" : "Scale plan with the HIPAA add-on", quote: "q", source: `https://${t.slug}.example/hipaa` } } },
});

describe("Compliance in the ranking", () => {
  it("detects health data from plain words", () => {
    const needs = detectNeeds("An app where therapists write session notes about their patients").map((n) => n.need);
    expect(needs).toContain("health_data");
    expect(needs).toContain("regulated");
    expect(detectNeeds("A todo list for busy parents").map((n) => n.need)).not.toContain("health_data");
  });

  it("adds nothing unless the product's needs make it matter", () => {
    const t = withBaa(db("neon"), "no");
    expect(complianceFor(t, ["nextjs", "low_cost"])).toBeNull();
    expect(scoreTool(t, ["nextjs"], 4, false)).toBe(scoreTool(db("neon"), ["nextjs"], 4, false));
  });

  it("scores a stated no well below a stated yes, and leaves an unstated answer at 0", () => {
    const base = scoreTool(db("neon"), ["health_data"], 4, false);
    expect(scoreTool(withBaa(db("neon"), "yes"), ["health_data"], 4, false)).toBeCloseTo(base + 1);
    expect(scoreTool(withBaa(db("neon"), "plan"), ["health_data"], 4, false)).toBeCloseTo(base + 0.5);
    expect(scoreTool(withBaa(db("neon"), "no"), ["health_data"], 4, false)).toBeCloseTo(base - 3);
    expect(complianceFor(db("neon"), ["health_data"])).toMatchObject({ score: 0, items: [{ topic: "baa", answer: "unstated" }] });
  });

  it("ignores tools that don't hold user data", () => {
    expect(complianceFor(withBaa(db("cloudflare-dns"), "no"), ["health_data"])).toBeNull();
  });

  it("moves the database pick away from a vendor that says it won't sign a BAA", () => {
    const description = "A web app where therapists write session notes about their patients";
    const pickOf = (all: Tool[]) => recommendStack({ tools: all, categories, recipes }, { description, assumeDefaults: true });
    const before = pickOf(tools).stack.find((s) => s.category === "database")!.pick;
    const changed = tools.map((t) => (t.slug === before.slug ? withBaa(t, "no") : t.category === "database" ? withBaa(t, "plan") : t));
    const after = pickOf(changed);
    const pick = after.stack.find((s) => s.category === "database")!.pick;
    expect(pick.slug).not.toBe(before.slug);
    expect(pick.compliance?.items[0]).toMatchObject({ topic: "baa", answer: "plan" });

    const text = renderRecommendation(after);
    expect(text).toContain("business associate agreement (BAA)");
    expect(text).toContain("## Compliance");
    expect(text).toContain(`${pick.name}: HIPAA BAA: only on some plans. Scale plan with the HIPAA add-on.`);
    expect(text).toMatch(/HIPAA BAA not stated on the pages Cuely reads for: .+\. Ask each/);
  });

  it("puts a pick's stated no at the top of the catches", () => {
    const description = "A web app where therapists write session notes about their patients";
    const all = tools.map((t) => (t.category === "database" ? withBaa(t, "no") : t));
    const r = recommendStack({ tools: all, categories, recipes }, { description, assumeDefaults: true });
    expect(r.summary!.catches[0].text).toContain("HIPAA BAA: no.");
  });

  it("says nothing about compliance for a product that doesn't need it", () => {
    const r = recommendStack({ tools, categories, recipes }, { description: "A Next.js habit tracker for busy parents", assumeDefaults: true });
    expect(r.stack.every((s) => s.pick.compliance === null)).toBe(true);
    expect(renderRecommendation(r)).not.toContain("## Compliance");
  });

  it("lists a tool's stated facts for comparisons", () => {
    expect(statedCompliance(undefined)).toEqual([]);
    expect(statedCompliance(withBaa(db("neon"), "yes").compliance)).toEqual(["HIPAA BAA: yes. Scale plan with the HIPAA add-on. (https://neon.example/hipaa)"]);
  });
});
