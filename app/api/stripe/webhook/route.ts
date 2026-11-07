import { getAccountStore } from "@/accounts/store";
import { paymentsConfig } from "@/billing/stripe";
import { handleStripeWebhook } from "@/billing/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const out = await handleStripeWebhook(raw, req.headers.get("stripe-signature"), paymentsConfig(), await getAccountStore());
  return Response.json({ message: out.message }, { status: out.status });
}
