/**
 * Plans change how much you can call Cuely, never what it answers.
 * The recommendation engine has no access to plans, accounts or payments.
 */
export type PlanId = "anonymous" | "free" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  /** MCP requests per minute. Anonymous is counted per IP, keyed plans per key. */
  perMinute: number;
  priceLabel: string;
  /** Monthly price in US cents. Checkout refuses a Stripe price that doesn't match. */
  priceCents: number;
  summary: string;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  anonymous: {
    id: "anonymous",
    name: "No account",
    perMinute: Number(process.env.CUELY_RATE_LIMIT_PER_MINUTE) || 60,
    priceLabel: "$0",
    priceCents: 0,
    summary: "Connect the endpoint and go.",
    features: ["Every tool, recipe and recommendation", "60 requests a minute per IP"],
  },
  free: {
    id: "free",
    name: "Free",
    perMinute: 120,
    priceLabel: "$0",
    priceCents: 0,
    summary: "Everything a solo builder needs. Most people never need more.",
    features: [
      "Every tool, recipe and recommendation",
      "The same answers as every other plan",
      "An API key for your agents",
      "120 requests a minute per key",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    perMinute: 1200,
    priceLabel: "$10 a month",
    priceCents: 1000,
    summary: "For teams and heavy automated use.",
    features: [
      "Everything in Free, with the same answers",
      "1,200 requests a minute per key",
      "Shared team workspaces and private recipes (coming)",
    ],
  },
};

export function planFor(plan: string | null | undefined): Plan {
  return plan === "pro" ? PLANS.pro : PLANS.free;
}
