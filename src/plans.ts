/**
 * Plans change how much you can call Cuely, never what it answers.
 * The recommendation engine has no access to plans, accounts or payments.
 *
 * The website is open to everyone. The MCP server needs an API key from an account,
 * free or Pro, and its limits are counted per account (all of its keys together).
 */
export type PlanId = "free" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  /** MCP requests per minute, per account. Covers every request, including connect and tools/list. */
  perMinute: number;
  /** Tool calls per day (UTC), per account. Connecting and listing tools don't count. */
  perDay: number;
  /** Active API keys an account can hold. */
  maxKeys: number;
  /** Stacks an account can save and watch on its account pages. */
  maxStacks: number;
  priceLabel: string;
  /** Monthly price in US cents. Checkout refuses a Stripe price that doesn't match. */
  priceCents: number;
  summary: string;
  features: string[];
}

const n = (v: number) => v.toLocaleString("en-US");

const free = { perMinute: 30, perDay: 50, maxKeys: 1, maxStacks: 3 };
const pro = { perMinute: 120, perDay: 5000, maxKeys: 10, maxStacks: 50 };

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    ...free,
    priceLabel: "$0",
    priceCents: 0,
    summary: "Everything a solo builder needs. Sign in with Google or GitHub and get a key in seconds.",
    features: [
      "Every tool, recipe and recommendation",
      "The same answers as every other plan",
      "One API key for your agents",
      `${free.maxStacks} saved stacks, watched for price and outage changes`,
      `${n(free.perDay)} tool calls a day, ${free.perMinute} requests a minute`,
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    ...pro,
    priceLabel: "$10 a month",
    priceCents: 1000,
    summary: "For agencies, teams and agents that run all day.",
    features: [
      "Everything in Free, with the same answers",
      `${n(pro.perDay)} tool calls a day, ${pro.perMinute} requests a minute`,
      `Up to ${pro.maxKeys} API keys`,
      `Up to ${pro.maxStacks} saved stacks`,
      "Daily usage history on your account page",
    ],
  },
};

export function planFor(plan: string | null | undefined): Plan {
  return plan === "pro" ? PLANS.pro : PLANS.free;
}
