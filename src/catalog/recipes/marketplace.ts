import type { Recipe } from "../types";

const V = "2026-11-07";

export const marketplace: Recipe = {
  slug: "marketplace",
  title: "Marketplace where customers pay providers and you keep a cut",
  summary:
    "A two-sided web app: providers list a service, customers book and pay, the platform keeps a percentage and pays providers out. Built on Next.js and Postgres, with Stripe Connect for onboarding, identity checks, split payments and payouts.",
  matches: [
    "marketplace", "two-sided", "take rate", "commission", "payouts", "pay out", "pay providers", "stripe connect",
    "connected accounts", "booking platform", "service providers", "buyers and sellers",
  ],
  fitsWhen: [
    "Customers pay providers through your product and you keep a fee on each payment.",
    "Providers are individuals or small businesses who need to be onboarded, verified and paid out.",
    "Payment is for a service or a physical good, so app-store in-app purchase rules don't apply.",
  ],
  notFor: [
    "Digital content sold inside an iOS or Android app: the stores' in-app purchase applies. Use the mobile-subscription-app recipe.",
    "Platforms that hold customer money for long periods, lend, or run wallets: that's money transmission and needs legal review first.",
    "A single seller charging their own customers: plain Stripe is simpler (see the b2b-saas recipe's billing step).",
  ],
  stack: [
    {
      category: "hosting",
      tool: "vercel",
      why: "Next.js hosting with preview deployments. The free Hobby plan is non-commercial, so a marketplace that takes money needs Pro.",
      alternatives: [{ tool: "render", when: "You need long-running workers for matching, reminders or payouts in the same app." }],
    },
    {
      category: "database",
      tool: "neon",
      why: "Postgres with transactions, exclusion constraints for double-booking, and extensions for location search; a database branch per preview.",
      alternatives: [{ tool: "supabase", when: "You want database, auth, storage and realtime chat from one vendor." }],
    },
    {
      category: "auth",
      tool: "clerk",
      why: "Prebuilt sign-in for two kinds of users. Keep the customer or provider role in your own database, set by the server.",
      alternatives: [
        { tool: "better-auth", when: "You want users in your own Postgres with no per-user fees." },
        { tool: "supabase-auth", when: "You chose Supabase for the database." },
      ],
    },
    {
      category: "payments",
      tool: "stripe-connect",
      why: "Onboards and verifies providers on Stripe-hosted pages, splits each payment so your fee stays with you, and pays providers to their bank.",
      alternatives: [],
    },
    {
      category: "email",
      tool: "resend",
      why: "Booking confirmations, reminders and cancellation notices from your own domain.",
      alternatives: [{ tool: "postmark", when: "Transactional deliverability and long retention matter most." }],
    },
    {
      category: "monitoring",
      tool: "sentry",
      why: "Error tracking for the booking and payment paths, where a silent failure costs a provider money.",
      alternatives: [{ tool: "better-stack", when: "You also want uptime checks and a status page." }],
    },
    {
      category: "analytics",
      tool: "posthog",
      why: "Funnels on both sides: provider sign-up to first booking, and customer search to paid booking.",
      alternatives: [{ tool: "plausible", when: "You only need traffic stats for the marketing site." }],
      optional: true,
    },
    {
      category: "storage",
      tool: "cloudflare-r2",
      why: "Provider photos and documents with no egress fees.",
      alternatives: [{ tool: "vercel-blob", when: "Uploads are small and you want zero setup on Vercel." }],
      optional: true,
    },
  ],
  steps: [
    {
      title: "Scaffold the app and choose who handles Stripe pricing",
      detail:
        "Decide one Connect setting first, because it changes your fees and your tax filing: whether Stripe bills providers for payment fees, or you set the pricing.",
      actions: [
        "Create a Next.js app with one validated env module for Stripe, Clerk and the database.",
        "In the Stripe dashboard, set up Connect as a marketplace. Stripe recommends describing connected accounts with controller properties (who pays fees, who's liable, which dashboard) rather than the older Standard, Express and Custom types.",
        "If Stripe handles pricing for connected accounts, there are no extra Connect fees and Stripe issues 1099-K forms where required. If you handle pricing, Connect adds $2 per monthly active account, 0.25% + 25¢ per payout and 0.25% of payout volume, and you file any 1099s.",
        "For a local service marketplace, give providers the Stripe-hosted dashboard and onboarding so you don't build KYC screens.",
      ],
      commands: ["npx create-next-app@latest my-marketplace --ts --eslint --app --src-dir", "npm i stripe zod @clerk/nextjs"],
      check: "You can state who pays Stripe's fees, who is liable for refunds and disputes, and who files 1099s.",
      docs: ["https://stripe.com/connect/pricing", "https://docs.stripe.com/connect/accounts"],
    },
    {
      title: "Model providers, bookings and money in Postgres",
      detail:
        "Bookings move through states, and every money movement gets a row you can reconcile against Stripe.",
      actions: [
        "Create users with a role, providers with their Stripe account id and onboarding flags, services, availability and bookings.",
        "Stop double-booking in the database with an exclusion constraint on the provider and time range, not only in code.",
        "Record each payment, platform fee, transfer and refund in a payments table keyed by Stripe ids.",
        "For 'near me' search, store a location per provider and use the earthdistance extension (with cube) or PostGIS; check your Postgres provider's list of supported extensions.",
        "Keep a stripe_events table for webhook idempotency.",
      ],
      files: [
        {
          path: "db/001_marketplace.sql",
          contents:
            "create extension if not exists btree_gist;\n\ncreate table users (\n  id uuid primary key default gen_random_uuid(),\n  auth_user_id text unique not null,\n  email text not null,\n  role text not null check (role in ('customer','provider','admin')),\n  created_at timestamptz not null default now()\n);\n\ncreate table providers (\n  user_id uuid primary key references users(id) on delete cascade,\n  stripe_account_id text unique,\n  charges_enabled boolean not null default false,   -- mirrored from account.updated\n  payouts_enabled boolean not null default false,\n  background_check text not null default 'none' check (background_check in ('none','pending','clear','consider')),\n  lat double precision,\n  lng double precision\n);\n\ncreate table services (\n  id uuid primary key default gen_random_uuid(),\n  provider_id uuid not null references providers(user_id) on delete cascade,\n  title text not null,\n  price_cents integer not null check (price_cents > 0),\n  duration_minutes integer not null\n);\n\ncreate table bookings (\n  id uuid primary key default gen_random_uuid(),\n  service_id uuid not null references services(id),\n  provider_id uuid not null references providers(user_id),\n  customer_id uuid not null references users(id),\n  during tstzrange not null,\n  status text not null check (status in ('pending_payment','confirmed','completed','cancelled','refunded')),\n  created_at timestamptz not null default now(),\n  -- no two live bookings for one provider may overlap\n  exclude using gist (provider_id with =, during with &&) where (status in ('pending_payment','confirmed'))\n);\n\ncreate table payments (\n  id bigserial primary key,\n  booking_id uuid not null references bookings(id),\n  stripe_payment_intent text unique,\n  amount_cents integer not null,\n  platform_fee_cents integer not null,\n  refunded_cents integer not null default 0,\n  status text not null,\n  created_at timestamptz not null default now()\n);\n\ncreate table stripe_events (\n  id text primary key,\n  type text not null,\n  processed_at timestamptz not null default now()\n);\n",
        },
      ],
      check: "Inserting two overlapping confirmed bookings for one provider fails in the database.",
      docs: ["https://www.postgresql.org/docs/current/btree-gist.html", "https://neon.com/docs/extensions/pg-extensions"],
    },
    {
      title: "Add sign-in with two roles",
      detail: "Customers and providers sign in the same way; what they can do depends on a role your server sets.",
      actions: [
        "Add Clerk's Next.js middleware and sign-in pages.",
        "On first sign-in, create the users row with role customer. Switching to provider is a server action that starts Stripe onboarding.",
        "Check the role on the server for every provider-only action; never trust a role from the browser.",
        "Let admins see all bookings and payments, and log every admin action.",
      ],
      check: "A customer account can't open provider pages or change a service's price.",
      docs: ["https://clerk.com/docs/nextjs/getting-started/quickstart"],
    },
    {
      title: "Onboard providers with Stripe Connect",
      detail: "Providers give their identity and bank details to Stripe, not to you. List them only once Stripe says they can be paid.",
      actions: [
        "Create a connected account for each provider and save its id on the providers row.",
        "Send the provider to a Stripe-hosted Account Link for onboarding; handle the return and refresh URLs.",
        "Listen for account.updated and mirror charges_enabled and payouts_enabled.",
        "Hide a provider from search until both are true, and show them what's missing if Stripe asks for more information later.",
      ],
      files: [
        {
          path: "src/app/api/connect/onboard/route.ts",
          contents:
            'import Stripe from "stripe";\nimport { env } from "@/env";\nimport { db, currentProvider } from "@/db";\n\nconst stripe = new Stripe(env.STRIPE_SECRET_KEY);\n\nexport async function POST() {\n  const provider = await currentProvider(); // server-side session check\n  let accountId = provider.stripe_account_id;\n  if (!accountId) {\n    // Shape the account to the setup you chose in step 1 (see Stripe\'s Connect docs).\n    const account = await stripe.accounts.create({\n      email: provider.email,\n      controller: {\n        fees: { payer: "application" },\n        losses: { payments: "application" },\n        stripe_dashboard: { type: "express" },\n      },\n    });\n    accountId = account.id;\n    await db.setStripeAccount(provider.user_id, accountId);\n  }\n  const link = await stripe.accountLinks.create({\n    account: accountId,\n    type: "account_onboarding",\n    refresh_url: `${env.APP_URL}/provider/onboarding?retry=1`,\n    return_url: `${env.APP_URL}/provider/onboarding/done`,\n  });\n  return Response.json({ url: link.url });\n}\n',
        },
      ],
      check: "A test provider completes onboarding with Stripe's test data and shows charges_enabled and payouts_enabled in your table.",
      docs: ["https://docs.stripe.com/connect/accounts", "https://docs.stripe.com/connect/onboarding"],
    },
    {
      title: "Take payment and keep your fee",
      detail:
        "Use destination charges: the customer pays the platform, Stripe moves the provider's share to their account, and your fee stays in your balance. Stripe's docs call this the best fit for marketplaces.",
      actions: [
        "Create a Checkout Session in payment mode with payment_intent_data.transfer_data.destination set to the provider's account and application_fee_amount set to your cut (15% of the price, in cents).",
        "Put the booking id in metadata, and create the booking as pending_payment so the slot is held.",
        "Confirm the booking only from the webhook, never from the redirect back to your site.",
        "Release unpaid held slots after a short timeout so abandoned checkouts don't block providers.",
        "For bookings far in the future, charge at booking and refund on cancellation; card authorizations expire, so check Stripe's window before relying on authorize-now, capture-later.",
      ],
      files: [
        {
          path: "src/app/api/bookings/checkout/route.ts",
          contents:
            'import Stripe from "stripe";\nimport { env } from "@/env";\nimport { db } from "@/db";\n\nconst stripe = new Stripe(env.STRIPE_SECRET_KEY);\nconst TAKE_RATE = 0.15;\n\nexport async function POST(req: Request) {\n  const { serviceId, start } = await req.json();\n  const booking = await db.holdSlot(serviceId, new Date(start)); // inserts pending_payment; fails on overlap\n  const fee = Math.round(booking.price_cents * TAKE_RATE);\n  const session = await stripe.checkout.sessions.create({\n    mode: "payment",\n    line_items: [{ price_data: { currency: "usd", unit_amount: booking.price_cents, product_data: { name: booking.title } }, quantity: 1 }],\n    payment_intent_data: {\n      application_fee_amount: fee,\n      transfer_data: { destination: booking.provider_stripe_account_id },\n      metadata: { booking_id: booking.id },\n    },\n    metadata: { booking_id: booking.id },\n    success_url: `${env.APP_URL}/bookings/${booking.id}?paid=1`,\n    cancel_url: `${env.APP_URL}/bookings/${booking.id}?cancelled=1`,\n  });\n  return Response.json({ url: session.url });\n}\n',
        },
      ],
      check: "In test mode, a $25 booking shows $25 charged, $3.75 application fee in your balance, and the rest transferred to the provider.",
      docs: ["https://docs.stripe.com/connect/charges", "https://docs.stripe.com/connect/destination-charges"],
    },
    {
      title: "Handle webhooks, refunds and disputes",
      detail:
        "With destination charges, refunds and chargebacks come out of the platform's balance first, so your code must reverse the provider's share deliberately.",
      actions: [
        "Verify every webhook signature on the raw body and skip event ids you've already processed.",
        "Handle checkout.session.completed (confirm the booking), charge.refunded, charge.dispute.created and account.updated.",
        "Add a second endpoint, or enable connected-account events, for events that happen on providers' accounts, such as payouts.",
        "Refund with reverse_transfer so the provider's share comes back, and decide per your policy whether to refund_application_fee.",
        "Write the cancellation and refund policy into your terms before launch, and apply it in code the same way every time.",
      ],
      commands: ["stripe listen --forward-to localhost:3000/api/stripe/webhook --forward-connect-to localhost:3000/api/stripe/connect-webhook"],
      check: "A refunded test booking returns the customer's money, takes back the provider's transfer, and replaying the webhook changes nothing.",
      docs: ["https://docs.stripe.com/webhooks", "https://docs.stripe.com/connect/webhooks"],
    },
    {
      title: "Build trust and safety in",
      detail: "Stripe verifies who providers are for payments. Whether they're safe to send into a home is a separate check.",
      actions: [
        "For in-home or care services, run background checks with a consumer reporting agency (Checkr Basic starts at $29.99 a report plus pass-through fees) and follow the FCRA consent and adverse-action steps.",
        "Allow reviews only from customers with a completed booking, one per booking.",
        "Keep messaging inside the app until a booking is paid, so payments don't leak off the platform.",
        "Add report and block buttons, and a way for admins to pause a provider.",
      ],
      check: "A provider without a clear check can't be booked for in-home services, and a review can't be left without a completed booking.",
      docs: ["https://checkr.com/pricing"],
    },
    {
      title: "Send booking email and reminders",
      detail: "Both sides need a confirmation, a reminder before the booking, and a notice when anything changes.",
      actions: [
        "Verify a sending subdomain in Resend with SPF and DKIM, and add DMARC on the root domain.",
        "Send booking confirmed, reminder the day before, cancelled, refunded and payout sent.",
        "Run reminders from a scheduled job that reads upcoming confirmed bookings, and record each send to avoid duplicates.",
      ],
      commands: ["npm i resend @react-email/components"],
      check: "A test booking sends both sides a confirmation and a reminder, once each.",
      docs: ["https://resend.com/docs/dashboard/domains/introduction"],
    },
    {
      title: "Go live",
      detail: "Switch to live mode only when hosting, terms and tax setup are ready.",
      actions: [
        "Move the Vercel project to Pro before the first real payment; Hobby is for non-commercial use.",
        "Publish terms that cover your fee, cancellations, refunds and who provides the service, and a privacy policy that lists your vendors.",
        "Complete the Connect platform profile in the Stripe dashboard, then create live connected accounts; test accounts don't carry over.",
        "Add Sentry and tag errors with booking id, never with personal data.",
        "Ask a tax professional whether you collect sales tax on your service fee in your states.",
      ],
      commands: ["npx @sentry/wizard@latest -i nextjs"],
      check: "One real booking between two people you know goes from search to payout without manual fixes.",
      docs: ["https://docs.stripe.com/connect/tax-reporting", "https://vercel.com/pricing"],
    },
  ],
  bestPractices: [
    "Choose who handles Stripe pricing before you build; it decides your Connect fees and who files tax forms.",
    "Confirm bookings and grant anything of value only from verified webhooks.",
    "Prevent double-booking with a database constraint, not just a check in code.",
    "Record every charge, fee, transfer and refund with its Stripe id so you can reconcile each payout.",
    "List a provider only when Stripe reports both charges and payouts enabled.",
    "Write the refund policy once and apply it in code the same way every time.",
  ],
  pitfalls: [
    "Collecting money on your own Stripe account and paying providers by hand; that's money transmission territory and a reconciliation mess.",
    "Using direct charges when you want to own the customer relationship and liability, or destination charges without planning for refunds coming out of your balance.",
    "Refunding without reverse_transfer, so the platform pays the whole refund while the provider keeps their share.",
    "Launching on Vercel Hobby, which is for non-commercial use.",
    "Letting customers and providers swap phone numbers before the first payment.",
  ],
  complianceNotes: [
    "Background checks in the US are consumer reports under the FCRA: you need written consent before the check and an adverse-action process after. Use a provider that handles these steps.",
    "Who files 1099 forms depends on your Connect setup: Stripe issues 1099-K where it controls pricing; otherwise the platform files. Thresholds are on Stripe's tax reporting page.",
    "If you hold funds, delay payouts for long periods, or let users keep balances, get legal advice on money transmission before launch.",
    "Sales tax on marketplace service fees varies by state and country; this recipe doesn't decide it.",
    "If providers are workers rather than independent businesses under local law, that changes your obligations; get advice for your market.",
  ],
  catches: [
    {
      text: "With Stripe handling pricing for connected accounts there are no extra Connect fees; if you handle pricing it's $2 per monthly active account, 0.25% + 25¢ per payout and 0.25% of payout volume. Instant payouts are 1% of payout volume either way.",
      source: "https://stripe.com/connect/pricing",
      verifiedOn: V,
    },
    {
      text: "With destination charges, refunds and chargebacks reduce the platform's balance; reverse the provider's transfer on refunds.",
      source: "https://docs.stripe.com/connect/charges",
      verifiedOn: V,
    },
    {
      text: "Stripe issues 1099-K forms for connected accounts only where Stripe controls pricing; where the platform controls pricing, the platform files any 1099s.",
      source: "https://docs.stripe.com/connect/tax-reporting",
      verifiedOn: V,
    },
    {
      text: "Vercel's Hobby plan is for personal, non-commercial use; a marketplace that takes payments needs Pro ($20 a month per developer seat).",
      source: "https://vercel.com/pricing",
      verifiedOn: V,
    },
  ],
  costNotes: [
    "Card fees: 2.9% + 30¢ per domestic card charge, +1.5% for international cards. On a $25 booking that's $1.03, against your 15% fee of $3.75, so you net about $2.72 if the platform absorbs the card fee.",
    "At 1,000 bookings a month at $25: $25,000 charged, $3,750 in fees to you, about $1,025 in card fees, so about $2,725 before Connect fees.",
    "If you handle pricing in Connect, add $2 per provider paid that month plus 0.25% + 25¢ per payout and 0.25% of payout volume: 100 providers paid weekly is about $200 + 400 payouts × $0.25 + 0.5% of $21,250 = about $406 a month.",
  ],
  verifiedOn: V,
};
