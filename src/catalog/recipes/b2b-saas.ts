import type { Recipe } from "../types";

export const b2bSaas: Recipe = {
  slug: "b2b-saas",
  title: "B2B SaaS with auth, billing and email",
  summary:
    "A multi-tenant web app sold to companies: organizations with roles, subscription billing per organization, and transactional email. Built on Next.js, Postgres, hosted auth and Stripe.",
  matches: [
    "b2b", "saas", "subscription", "multi-tenant", "multitenant", "tenant", "workspace", "workspaces", "team plan",
    "teams", "organizations", "seats", "dashboard for companies", "business customers", "fintech", "crm", "erp",
    "admin portal", "client portal", "internal tool for companies",
  ],
  fitsWhen: [
    "Customers are companies, and several people from one company share an account.",
    "You charge a recurring subscription, per organization or per seat.",
    "You need invites, roles, receipts and password-less or SSO sign-in.",
  ],
  notFor: [
    "Consumer apps with one user per account (drop the organization layer).",
    "Marketplaces that pay out to sellers (you need Stripe Connect and a different money flow).",
    "Apps that move or hold customer money (fintech ledgers need licensing review first).",
  ],
  stack: [
    {
      category: "hosting",
      tool: "vercel",
      why: "Native Next.js hosting with preview deployments. Use Pro once you charge customers; Hobby is non-commercial.",
      alternatives: [
        { tool: "render", when: "You need long-running workers or websockets in the same app." },
        { tool: "cloudflare-workers", when: "Cost at very high request volume matters more than native Next.js." },
      ],
    },
    {
      category: "database",
      tool: "neon",
      why: "Plain Postgres that scales to zero, with a database branch for each preview deployment.",
      alternatives: [
        { tool: "supabase", when: "You want database, auth and storage from one vendor." },
        { tool: "turso", when: "You want a separate database per customer." },
      ],
    },
    {
      category: "auth",
      tool: "workos-authkit",
      why: "Organizations are the core model, 1M monthly users are free, and enterprise SSO is ready when a large customer asks.",
      alternatives: [
        { tool: "clerk", when: "You want prebuilt sign-in UI fastest and don't expect enterprise SSO soon." },
        { tool: "better-auth", when: "You want users in your own database with no per-user fees, and will run it yourself." },
      ],
    },
    {
      category: "payments",
      tool: "stripe",
      why: "Subscriptions, seats, invoices and a hosted customer portal at the lowest base fee.",
      alternatives: [
        { tool: "paddle", when: "You sell worldwide and want a merchant of record to file sales tax and VAT." },
      ],
    },
    {
      category: "email",
      tool: "resend",
      why: "Simple API with React Email templates and 3,000 free emails a month.",
      alternatives: [{ tool: "postmark", when: "Transactional deliverability and long retention matter most." }],
    },
    {
      category: "secrets",
      tool: "infisical",
      why: "One source of truth for env vars across dev, preview and production, synced to Vercel.",
      alternatives: [{ tool: "doppler", when: "You prefer a hosted service with more integrations." }],
      optional: true,
    },
    {
      category: "dns",
      tool: "cloudflare-dns",
      why: "Free DNS with a good API; holds the app and email records.",
      alternatives: [{ tool: "amazon-route-53", when: "Your infrastructure is on AWS." }],
    },
    {
      category: "monitoring",
      tool: "sentry",
      why: "Error tracking with source maps from the official Next.js SDK.",
      alternatives: [{ tool: "better-stack", when: "You also want uptime checks and a public status page." }],
    },
    {
      category: "analytics",
      tool: "posthog",
      why: "Group analytics shows usage per customer account, which is what B2B decisions need.",
      alternatives: [{ tool: "plausible", when: "You only need cookieless traffic stats for the marketing site." }],
      optional: true,
    },
    {
      category: "storage",
      tool: "cloudflare-r2",
      why: "S3-compatible uploads and exports with no egress fees.",
      alternatives: [{ tool: "vercel-blob", when: "Uploads are small and you want zero setup on Vercel." }],
      optional: true,
    },
  ],
  steps: [
    {
      title: "Scaffold the app",
      detail: "Start from a typed Next.js App Router project with strict TypeScript and a single env schema.",
      actions: [
        "Create the app with TypeScript, ESLint and the App Router.",
        "Add one env module that validates every variable at startup (zod), and import env only from there.",
        "Commit a .env.example with every variable name and no values.",
      ],
      commands: ["npx create-next-app@latest my-saas --ts --eslint --app --src-dir", "npm i zod"],
      files: [
        {
          path: "src/env.ts",
          contents:
            'import { z } from "zod";\n\nexport const env = z\n  .object({\n    DATABASE_URL: z.string().url(),\n    WORKOS_API_KEY: z.string().min(1),\n    WORKOS_CLIENT_ID: z.string().min(1),\n    WORKOS_COOKIE_PASSWORD: z.string().min(32),\n    STRIPE_SECRET_KEY: z.string().startsWith("sk_"),\n    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),\n    RESEND_API_KEY: z.string().startsWith("re_"),\n    APP_URL: z.string().url(),\n  })\n  .parse(process.env);\n',
        },
      ],
      check: "The app boots locally and fails fast with a clear message when a variable is missing.",
    },
    {
      title: "Model tenancy in Postgres",
      detail:
        "Every customer is an organization. Every row that belongs to a customer carries organization_id, and every query filters by it.",
      actions: [
        "Create a Neon project with a main branch for production and a dev branch for local work.",
        "Create organizations, users, memberships (user, organization, role) and an audit_log table.",
        "Add organization_id to every tenant-owned table, with an index, and a foreign key to organizations.",
        "Put all tenant queries behind one data-access layer that requires an organization id, or enable Postgres row-level security keyed on it.",
        "Use a migration tool (Drizzle Kit, Prisma Migrate or plain SQL files) and run migrations in CI, not by hand.",
      ],
      files: [
        {
          path: "db/001_tenancy.sql",
          contents:
            "create table organizations (\n  id uuid primary key default gen_random_uuid(),\n  name text not null,\n  auth_org_id text unique not null,      -- the auth provider's organization id\n  stripe_customer_id text unique,\n  plan text not null default 'free',\n  subscription_status text,              -- mirrored from Stripe webhooks\n  current_period_end timestamptz,\n  created_at timestamptz not null default now()\n);\n\ncreate table users (\n  id uuid primary key default gen_random_uuid(),\n  auth_user_id text unique not null,\n  email text not null,\n  created_at timestamptz not null default now()\n);\n\ncreate table memberships (\n  organization_id uuid not null references organizations(id) on delete cascade,\n  user_id uuid not null references users(id) on delete cascade,\n  role text not null check (role in ('owner','admin','member')),\n  primary key (organization_id, user_id)\n);\n\ncreate table audit_log (\n  id bigserial primary key,\n  organization_id uuid not null references organizations(id) on delete cascade,\n  actor_user_id uuid references users(id),\n  action text not null,\n  details jsonb not null default '{}',\n  created_at timestamptz not null default now()\n);\ncreate index on audit_log (organization_id, created_at desc);\n\ncreate table stripe_events (            -- webhook idempotency\n  id text primary key,\n  type text not null,\n  processed_at timestamptz not null default now()\n);\n",
        },
      ],
      check: "A test that queries as organization A can never read organization B's rows.",
      docs: ["https://neon.com/docs/introduction/branching"],
    },
    {
      title: "Add auth with organizations",
      detail:
        "Use the auth provider for sign-in and organization membership; keep your own users and memberships tables in sync for joins and permissions.",
      actions: [
        "Install the AuthKit Next.js SDK and add the callback route and session middleware it documents.",
        "On first sign-in, upsert the user and, if they have no organization, create one and make them owner.",
        "Store the provider's organization id on your organizations row (auth_org_id).",
        "Build invites: an owner or admin invites by email; the invite carries the role.",
        "Check the role on the server for every mutating action; never trust a role sent from the browser.",
        "Leave SSO off until a customer asks; turning it on is per organization, priced per connection.",
      ],
      commands: ["npm i @workos-inc/authkit-nextjs"],
      check: "Two users in one organization see the same data; a user in another organization sees none of it.",
      docs: ["https://workos.com/docs/authkit", "https://workos.com/docs/user-management/organizations"],
    },
    {
      title: "Add subscription billing per organization",
      detail:
        "Bill the organization, not the person. Stripe is the source of truth for subscription state; your database mirrors it from webhooks.",
      actions: [
        "Create Products and Prices in the Stripe dashboard (test mode first). Use per-seat quantity if you price by seat.",
        "Create one Stripe Customer per organization and store stripe_customer_id on the organization.",
        "Start upgrades with a Checkout Session in subscription mode, passing the organization id in metadata.",
        "Use the Stripe customer portal for plan changes, cards and invoices instead of building those screens.",
        "Handle webhooks in one route: verify the signature on the raw body, skip event ids already in stripe_events, then update the organization.",
        "Handle at least checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted and invoice.payment_failed.",
        "Gate features on the organization's mirrored plan and subscription_status on the server, never on a client flag.",
        "Turn on Stripe Tax if you sell where you're registered, or choose a merchant of record instead (see alternatives).",
      ],
      commands: ["npm i stripe", "stripe listen --forward-to localhost:3000/api/stripe/webhook"],
      files: [
        {
          path: "src/app/api/stripe/webhook/route.ts",
          contents:
            'import Stripe from "stripe";\nimport { env } from "@/env";\nimport { db } from "@/db";\n\nconst stripe = new Stripe(env.STRIPE_SECRET_KEY);\n\nexport async function POST(req: Request) {\n  const body = await req.text(); // raw body: required for signature checks\n  const signature = req.headers.get("stripe-signature") ?? "";\n  let event: Stripe.Event;\n  try {\n    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);\n  } catch {\n    return new Response("bad signature", { status: 400 });\n  }\n\n  // Idempotency: Stripe retries, and events can arrive out of order.\n  const fresh = await db.recordStripeEvent(event.id, event.type);\n  if (!fresh) return new Response("ok");\n\n  switch (event.type) {\n    case "customer.subscription.created":\n    case "customer.subscription.updated":\n    case "customer.subscription.deleted": {\n      const sub = event.data.object;\n      // Re-read from Stripe rather than trusting event order.\n      const latest = await stripe.subscriptions.retrieve(sub.id);\n      await db.syncSubscription(String(latest.customer), latest);\n      break;\n    }\n    case "invoice.payment_failed":\n      await db.flagPaymentFailed(String(event.data.object.customer));\n      break;\n  }\n  return new Response("ok");\n}\n',
        },
      ],
      check:
        "In test mode, a checkout upgrades the organization, a cancel in the portal downgrades it, and replaying the same webhook changes nothing.",
      docs: [
        "https://docs.stripe.com/billing/subscriptions/build-subscriptions",
        "https://docs.stripe.com/webhooks",
        "https://docs.stripe.com/customer-management",
      ],
    },
    {
      title: "Send transactional email",
      detail: "Send invites, payment-failed notices and account email from a verified subdomain.",
      actions: [
        "Verify a sending subdomain (for example mail.yourdomain.com) in Resend and add its SPF and DKIM records in DNS.",
        "Add a DMARC record for the root domain, starting at p=none with reporting, then tighten.",
        "Write templates with React Email: invite, welcome, payment failed, and plan changed.",
        "Let Stripe send receipts and invoices; don't duplicate them.",
        "Send from a server action or a queue, never from the browser, and log the message id against the organization.",
      ],
      commands: ["npm i resend @react-email/components"],
      check: "An invite email lands in the inbox (not spam) for Gmail and Outlook test accounts.",
      docs: ["https://resend.com/docs/introduction", "https://resend.com/docs/dashboard/domains/introduction"],
    },
    {
      title: "Manage secrets per environment",
      detail: "Keep one copy of each secret per environment and sync it to the host; never commit secrets.",
      actions: [
        "Create development, preview and production environments in Infisical.",
        "Use Stripe test keys in development and preview, and live keys in production only.",
        "Sync each environment to the matching Vercel environment.",
        "Add a pre-commit secret scan (for example gitleaks) and rotate any key that was ever committed.",
      ],
      check: "A fresh clone runs with secrets pulled from Infisical and no .env file in git history.",
      docs: ["https://infisical.com/docs/integrations/cloud/vercel"],
    },
    {
      title: "Connect the domain",
      detail: "Point the app's domain at the host and keep email records in the same DNS zone.",
      actions: [
        "Add the domain to the Vercel project and create the records Vercel shows in Cloudflare DNS.",
        "Set those records to DNS only (not proxied) unless you deliberately want Cloudflare's proxy in front.",
        "Keep the Resend SPF, DKIM and DMARC records in the same zone.",
      ],
      check: "The apex and www load over HTTPS, and email authentication checks pass.",
      docs: ["https://vercel.com/docs/domains/working-with-domains/add-a-domain"],
    },
    {
      title: "Add monitoring and analytics",
      detail: "Know about errors before customers report them, and measure usage per customer account.",
      actions: [
        "Install the Sentry Next.js SDK with the wizard and upload source maps in production builds.",
        "Tag every Sentry event with organization id, never with email or other personal data.",
        "Add an uptime check on a /api/health route.",
        "Install PostHog, identify users, and set the organization as a group so usage rolls up per customer.",
      ],
      commands: ["npx @sentry/wizard@latest -i nextjs", "npm i posthog-js"],
      check: "A thrown test error appears in Sentry with a readable stack trace and the organization tag.",
      docs: ["https://docs.sentry.io/platforms/javascript/guides/nextjs/", "https://posthog.com/docs/product-analytics/group-analytics"],
    },
    {
      title: "Set a security baseline",
      detail: "The things business customers ask about in their first security questionnaire.",
      actions: [
        "Write an audit_log row for sign-ins, invites, role changes, billing changes and data exports.",
        "Rate-limit sign-in, invite and webhook routes.",
        "Use a least-privilege database role for the app; keep the owner role for migrations.",
        "Confirm point-in-time restore is available on the database plan, and test a restore once.",
        "Add a way for an owner to export and delete their organization's data.",
      ],
      check: "You can answer: who changed what, when; how to restore yesterday's data; and how to delete a customer.",
    },
    {
      title: "Ship with preview environments",
      detail: "Every pull request gets its own deployment and database branch; production deploys from main.",
      actions: [
        "Connect the Git repo to Vercel so each pull request gets a preview deployment.",
        "Use the Neon integration or a CI step to create a database branch per preview and run migrations on it.",
        "Move the Vercel project to Pro before the first paying customer; Hobby is non-commercial.",
        "Switch Stripe to live mode only in the production environment.",
      ],
      check: "A pull request shows a working preview with its own data, and merging deploys production.",
      docs: ["https://neon.com/docs/guides/vercel-overview"],
    },
  ],
  bestPractices: [
    "Bill the organization, not the user; seats are a quantity on the organization's subscription.",
    "Treat Stripe as the source of truth for billing and mirror it from webhooks; never set a plan from the client.",
    "Make webhook handlers idempotent and re-read objects from Stripe instead of trusting event order.",
    "Filter every tenant query by organization id in one shared layer, and test cross-tenant access.",
    "Keep test and live keys in separate environments so a preview can never charge a real card.",
    "Store provider ids (auth org id, Stripe customer id) on your rows so you can reconcile both ways.",
    "Write an audit log from day one; adding it later means no history for the first customers.",
  ],
  pitfalls: [
    "Billing per user instead of per organization, then rebuilding billing when a second teammate joins.",
    "Parsing the webhook body as JSON before verifying the signature (signature checks need the raw body).",
    "Granting access on the Checkout redirect instead of on the webhook; redirects can be faked or skipped.",
    "Launching a paid product on a free hosting plan that is non-commercial only.",
    "Sending email from the root domain with no DMARC, then landing in spam.",
  ],
  complianceNotes: [
    "Keeping card entry on Stripe-hosted Checkout or Elements keeps your PCI DSS scope small; it doesn't remove it.",
    "Business customers often ask for SOC 2. This stack makes the evidence easier to gather, but SOC 2 is an audit of your company, not of your vendors.",
    "If you sell to EU customers, you need a data processing agreement with each vendor that handles personal data, and a privacy policy that lists them.",
    "Fintech products that hold, move or lend money may need licenses or a regulated partner. This recipe covers SaaS billing only, not money movement.",
  ],
  verifiedOn: "2026-11-06",
};
