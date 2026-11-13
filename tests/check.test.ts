import { describe, expect, it } from "vitest";
import { categories, recipes, tools, type Tool, type ToolCompliance } from "@/catalog";
import { checkProject } from "@/engine/check";
import { recommendStack, SWITCH_COST } from "@/engine/recommend";

const snap = { categories, tools, recipes };

/** The catalog with some tools changed, as a weekly data run would change them. */
const withTools = (patch: Record<string, Partial<Tool>>) => ({
  ...snap,
  tools: tools.map((t) => (patch[t.slug] ? { ...t, ...patch[t.slug] } : t)),
});
const fact = (answer: "yes" | "plan" | "no", source: string) => ({ answer, detail: "Stated on the page.", quote: "q", source });
const compliance = (facts: ToolCompliance["facts"]): ToolCompliance => ({ facts, readOn: "2026-11-13" });
const item = (c: ReturnType<typeof checkProject>, slug: string) => c.items.find((i) => i.current?.slug === slug)!;

describe("check_project", () => {
  it("keeps a stack that matches what Cuely would pick", () => {
    const fresh = recommendStack(snap, { description: "B2B SaaS for companies with per-seat billing", assumeDefaults: true });
    const using = fresh.stack.filter((s) => s.role === "core").map((s) => s.pick.slug);
    const c = checkProject(snap, { description: "B2B SaaS for companies with per-seat billing", using });
    expect(c.status).toBe("ok");
    expect(c.items.every((i) => i.verdict === "keep")).toBe(true);
    expect(c.items.every((i) => i.gap === 0)).toBe(true);
    expect(c.headline).toMatch(/fine as they are/);
    expect(c.nextStep).toMatch(/Nothing needs to change/);
  });

  it("keeps a tool that is behind by less than the cost of switching, and says by how much", () => {
    const c = checkProject(snap, { description: "A web app for a book club, users pay a subscription", using: ["Supabase", "Vercel", "Clerk", "Stripe"] });
    for (const i of c.items.filter((x) => x.current)) {
      expect(i.gap).toBeLessThanOrEqual(SWITCH_COST);
      expect(i.verdict).toBe("keep");
    }
    const behind = c.items.find((i) => i.current && i.gap > 0);
    if (behind) expect(behind.why).toMatch(/under the 4 points/);
  });

  it("says to switch when a tool falls more than the switching cost behind", () => {
    const bad = withTools({ neon: { health: { score: -6, reasons: ["30 major incidents in the last 90 days."], measuredOn: "2026-11-12" } } });
    const c = checkProject(bad, { description: "A web app for a book club", using: ["Neon", "Vercel"] });
    const neon = item(c, "neon");
    expect(neon.verdict).toBe("switch");
    expect(neon.gap).toBeGreaterThan(SWITCH_COST);
    expect(neon.suggestion?.slug).toBeTruthy();
    expect(neon.watch[0]).toMatch(/30 major incidents/);
    expect(c.items[0]).toBe(neon);
    // recommend_stack agrees: already using Neon is no longer enough to keep it.
    const r = recommendStack(bad, { description: "A web app for a book club", alreadyUsing: ["Neon"], assumeDefaults: true });
    expect(r.stack.find((s) => s.category === "database")!.pick.slug).toBe(neon.suggestion!.slug);
  });

  it("says to switch when the vendor states it won't cover the product's data, whatever the score", () => {
    const facts = withTools({
      resend: { compliance: compliance({ baa: fact("no", "https://resend.com/security") }) },
      "amazon-ses": { compliance: compliance({ baa: fact("yes", "https://aws.amazon.com/compliance/hipaa-compliance/") }) },
    });
    const c = checkProject(facts, { description: "Therapists keep patient notes; patients pay monthly", using: ["Resend", "Neon"] });
    const resend = item(c, "resend");
    expect(resend.verdict).toBe("switch");
    expect(resend.why).toMatch(/HIPAA BAA: no/);
    expect(resend.suggestion?.compliance?.blockers).toEqual([]);
    expect(c.catches[0].text).toMatch(/business associate agreement/);
    // Without health data in the picture, the same fact changes nothing.
    const plain = checkProject(facts, { description: "A newsletter tool for bakeries", using: ["Resend"] });
    expect(item(plain, "resend").verdict).toBe("keep");
  });

  it("lists plan-only and unstated compliance answers as things to watch", () => {
    const facts = withTools({ neon: { compliance: compliance({ baa: fact("plan", "https://neon.com/docs/security/hipaa") }) } });
    const c = checkProject(facts, { description: "Clinic app with patient records", using: ["Neon", "Clerk"] });
    expect(item(c, "neon").watch.join(" ")).toMatch(/HIPAA BAA: only on some plans/);
    expect(item(c, "clerk").watch.join(" ")).toMatch(/HIPAA BAA: not stated/);
  });

  it("names core parts nothing covers, and keeps optional ones out of the verdicts", () => {
    const c = checkProject(snap, { description: "A web app where users pay a subscription", using: ["Vercel"] });
    const adds = c.items.filter((i) => i.verdict === "add").map((i) => i.category);
    expect(adds).toEqual(expect.arrayContaining(["database", "auth", "payments"]));
    expect(adds).not.toContain("analytics");
    expect(c.optionalAdds.map((o) => o.category)).toContain("analytics");
    expect(c.headline).toMatch(/to add/);
  });

  it("checks a tool in use even when the product type wouldn't call for its category", () => {
    const c = checkProject(snap, { description: "A simple web app for a book club", using: ["Stripe", "Pinecone"] });
    expect(item(c, "stripe").category).toBe("payments");
    expect(item(c, "pinecone").category).toBe("vector");
  });

  it("checks two tools in the same category separately", () => {
    const c = checkProject(snap, { description: "A web app for a book club", using: ["Supabase", "Neon"] });
    expect(c.items.filter((i) => i.category === "database" && i.current).length).toBe(2);
  });

  it("never asks: what the description leaves open is assumed and listed", () => {
    const c = checkProject(snap, { description: "an app", using: ["Neon"] });
    expect(c.status).toBe("ok");
    expect(c.assumed.length).toBeGreaterThan(0);
    const known = checkProject(snap, { description: "an app", using: ["Neon"], answers: { platform: "web", money: "none", audience: "customers" } });
    expect(known.assumed).toEqual([]);
  });

  it("reports names it doesn't know and stops when it knows none", () => {
    const c = checkProject(snap, { description: "A web app for a book club", using: ["Neon", "MadeUpDB"] });
    expect(c.notChecked).toEqual(["MadeUpDB"]);
    const none = checkProject(snap, { description: "A web app for a book club", using: ["MadeUpDB"] });
    expect(none.status).toBe("nothing_recognized");
    expect(none.items).toEqual([]);
  });

  it("says so when the product is outside coverage", () => {
    const c = checkProject(snap, { description: "A 3D shooter built in Unity for consoles", using: ["Neon"] });
    expect(c.status).toBe("outside_coverage");
  });
});
