import { describe, expect, it } from "vitest";
import { applyFacts, decide, factsOf, type Facts, type Proposal } from "@/freshness/facts";

const TODAY = "2026-11-16";
const current: Facts = {
  freeTier: "Hobby, $0/month: 1M function invocations per month.",
  paidStartsAt: "Pro: $20/month, including $20 of usage credit.",
  cost: { monthly: 20, basis: "Pro $20/month; the profile fits in the included $20 usage credit." },
};
const page = ["Hobby $0/month", "1M function invocations per month", "Pro $25/month", "Includes $25 of usage credit"];
const proposal = (over: Partial<Proposal>): Proposal => ({ verdict: "update", ...current, note: "Pro went from $20 to $25.", ...over });

describe("deciding on a proposed fact update", () => {
  it("only moves the verified date when the page still says the same", () => {
    expect(decide(current, proposal({ verdict: "unchanged" }), page, TODAY)).toEqual({ action: "confirm", update: { verifiedOn: TODAY } });
    expect(decide(current, proposal({}), page, TODAY)).toEqual({ action: "confirm", update: { verifiedOn: TODAY } });
  });

  it("publishes a change whose amounts are all on the page", () => {
    const d = decide(current, proposal({
      paidStartsAt: "Pro: $25/month, including $25 of usage credit.",
      cost: { monthly: 25, basis: "Pro $25/month; the profile fits in the included $25 usage credit." },
    }), page, TODAY);
    expect(d).toEqual({
      action: "publish",
      update: {
        verifiedOn: TODAY,
        paidStartsAt: "Pro: $25/month, including $25 of usage credit.",
        cost: { monthly: 25, basis: "Pro $25/month; the profile fits in the included $25 usage credit." },
      },
    });
  });

  it("holds wording that quotes an amount the page doesn't show", () => {
    const d = decide(current, proposal({ paidStartsAt: "Pro: $24/month." }), page, TODAY);
    expect(d).toEqual({ action: "hold", why: "The proposed wording quotes $24, which isn't on the page." });
  });

  it("allows the computed monthly total in the basis, but holds a large cost jump", () => {
    const lines = [...page, "$0.03 per 1,000 events"];
    const ok = decide({ ...current, cost: { monthly: 6, basis: "200,000 events at $0.02 per 1,000." } },
      proposal({ cost: { monthly: 9, basis: "200,000 events at $0.03 per 1,000 is $9." } }), lines, TODAY);
    expect(ok.action).toBe("publish");
    const jump = decide(current, proposal({ cost: { monthly: 25, basis: "Pro $25/month." } }), ["Pro $25/month"], TODAY);
    expect(jump.action).toBe("publish");
    const big = decide(current, proposal({ cost: { monthly: 99, basis: "Pro $99/month." } }), ["Pro $99/month"], TODAY);
    expect(big).toEqual({ action: "hold", why: "The monthly cost would jump from $20 to $99." });
    const tripled = decide({ ...current, cost: { monthly: 5, basis: "$5/month." } }, proposal({ cost: { monthly: 20, basis: "$20/month." } }), ["$20/month"], TODAY);
    expect(tripled.action).toBe("hold");
  });

  it("holds when the model is unsure", () => {
    expect(decide(current, proposal({ verdict: "unsure", note: "The Pro plan isn't in these lines." }), page, TODAY))
      .toEqual({ action: "hold", why: "The Pro plan isn't in these lines." });
  });
});

describe("laying updates over the catalog", () => {
  const tool = { ...current, cost: { ...current.cost!, scale: "1k_users" as const }, verifiedOn: "2026-11-09" };

  it("leaves a tool without an update alone", () => {
    expect(applyFacts(tool, undefined)).toBe(tool);
  });

  it("replaces only the fields the update carries and keeps the cost's scale", () => {
    const out = applyFacts(tool, { verifiedOn: TODAY, paidStartsAt: "Pro: $25/month.", cost: { monthly: 25, basis: "Pro $25/month." } });
    expect(out).toEqual({
      freeTier: current.freeTier,
      paidStartsAt: "Pro: $25/month.",
      cost: { monthly: 25, basis: "Pro $25/month.", scale: "1k_users" },
      verifiedOn: TODAY,
    });
    expect(applyFacts(tool, { verifiedOn: TODAY, freeTier: null }).freeTier).toBeNull();
  });

  it("reads back the facts a model is shown", () => {
    expect(factsOf(tool)).toEqual(current);
  });
});
