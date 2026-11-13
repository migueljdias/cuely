import type { Recipe } from "../types";

const V = "2026-11-13";

export const consumerWebApp: Recipe = {
  slug: "consumer-web-app",
  title: "Consumer web app with accounts and an optional paid plan",
  summary:
    "A web app for individual people, one person per account: a habit tracker, a journal, a budgeting tool, a recipe box, a hobby community. Next.js on Cloudflare Workers through the OpenNext adapter, Postgres on Neon, Better Auth with users in your own database, Stripe for a free-plus-paid model, and Resend for sign-in and account email.",
  matches: [
    "consumer", "consumers", "consumer app", "web app for people", "personal", "for individuals", "individual users",
    "habit tracker", "journal", "journaling", "budgeting", "budget app", "recipe box", "notes app",
    "to-do", "todo", "tracker", "community", "hobby", "freemium", "pro plan", "free tier", "paid plan",
  ],
  fitsWhen: [
    "Each account belongs to one person, not to a company or team.",
    "It runs in a web browser (a PWA counts); phone apps are a separate recipe.",
    "It's free to start, with an optional monthly or yearly paid plan, or no payments at all.",
  ],
  notFor: [
    "Products sold to companies, where several colleagues share an account (see the b2b-saas recipe).",
    "iOS or Android apps that sell subscriptions inside the app (see the mobile-subscription-app recipe).",
    "Products where users pay each other (see the marketplace recipe), and AI apps that answer from documents (see the ai-docs-app recipe).",
    "Live collaboration (shared whiteboards, multiplayer editing): you need a realtime service this recipe doesn't set up.",
    "Apps that store health, banking or children's data: the stack works, but read the compliance notes first.",
  ],
  stack: [
    {
      category: "hosting",
      tool: "cloudflare-workers",
      why: "Next.js runs on Workers through the OpenNext adapter (@opennextjs/cloudflare), static files are served free, and Workers Paid is $5/month for 10 million requests, so a consumer app that gets popular stays cheap. There are no data transfer charges.",
      alternatives: [
        { tool: "vercel", when: "You want native Next.js with no adapter, or you use Node middleware or the edge runtime. A paid product needs Pro ($20/month); Hobby is non-commercial." },
        { tool: "netlify", when: "You already host the marketing site there." },
      ],
    },
    {
      category: "database",
      tool: "neon",
      why: "Postgres that scales to zero, with a serverless driver that connects from Workers over HTTP, and database branches for previews.",
      alternatives: [{ tool: "supabase", when: "You want database, auth and file storage in one dashboard; free projects pause after a week with no activity." }],
    },
    {
      category: "auth",
      tool: "better-auth",
      why: "Open-source sign-in that keeps users in your own Postgres, with no per-user fees: a consumer app can grow to a million free accounts without an auth bill.",
      alternatives: [
        { tool: "clerk", when: "You want prebuilt sign-in screens and a user dashboard; free up to 50,000 retained users, but MFA and passkeys need a paid plan." },
        { tool: "supabase-auth", when: "The database is Supabase." },
      ],
    },
    {
      category: "payments",
      tool: "stripe",
      why: "Checkout in subscription mode for the paid plan, and the hosted customer portal so people can cancel or change card without writing to you.",
      alternatives: [
        { tool: "paddle", when: "You sell to consumers in many countries and want someone else to collect and file sales tax and VAT (5% + 50¢ per sale)." },
      ],
    },
    {
      category: "email",
      tool: "resend",
      why: "Verification, magic-link and password-reset email from your own domain, with React Email templates.",
      alternatives: [{ tool: "postmark", when: "Deliverability of sign-in email is the one thing you care about most." }],
    },
    {
      category: "monitoring",
      tool: "sentry",
      why: "Error alerts with readable stack traces, so you hear about a broken sign-up before users give up.",
      alternatives: [{ tool: "better-stack", when: "You also want an uptime check and a public status page." }],
    },
    {
      category: "analytics",
      tool: "posthog",
      why: "Sign-up funnel, how many people come back in week two, and which free users upgrade.",
      alternatives: [{ tool: "plausible", when: "Page and referrer counts are enough, and you want no cookie banner." }],
      optional: true,
    },
    {
      category: "storage",
      tool: "cloudflare-r2",
      why: "Profile photos and user uploads on the same Cloudflare account, with no egress fees.",
      alternatives: [{ tool: "vercel-blob", when: "You host on Vercel instead and uploads are small." }],
      optional: true,
    },
  ],
  steps: [
    {
      title: "Scaffold Next.js for Cloudflare Workers",
      detail:
        "Create the app with Cloudflare's template, which sets up the OpenNext adapter, wrangler.jsonc and the preview and deploy scripts.",
      actions: [
        "Create the app with the command below and pick TypeScript and the App Router.",
        "Check that wrangler.jsonc has the nodejs_compat flag and a compatibility_date of 2024-09-23 or later.",
        "Don't use the edge runtime: remove any `export const runtime = \"edge\"`, because the adapter doesn't support it. Node middleware (Next.js 15.2+) isn't supported yet either; use standard middleware.",
        "On Windows, develop inside WSL: OpenNext says Windows itself works only at your own risk.",
        "Add one env module that validates every variable at startup (zod), and commit a .env.example with names and no values.",
      ],
      commands: [
        "npm create cloudflare@latest -- my-app --framework=next --platform=workers",
        "npm run preview",
      ],
      files: [
        {
          path: "src/env.ts",
          contents:
            'import { z } from "zod";\n\nexport const env = z\n  .object({\n    DATABASE_URL: z.string().url(),\n    BETTER_AUTH_SECRET: z.string().min(32),\n    BETTER_AUTH_URL: z.string().url(),\n    RESEND_API_KEY: z.string().startsWith("re_"),\n    STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),\n    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),\n  })\n  .parse(process.env);\n',
        },
      ],
      check: "`npm run preview` serves the app locally on the Workers runtime, and it fails fast with a clear message when a variable is missing.",
      docs: ["https://opennext.js.org/cloudflare/get-started"],
    },
    {
      title: "Set up Postgres with one owner per row",
      detail: "Every row a person creates carries their user id, and every query filters by the signed-in user on the server.",
      actions: [
        "Create a Neon project with a main branch for production and a dev branch for local work; use the pooled connection string.",
        "Connect from the app with the Neon serverless driver, which works from Workers.",
        "Add user_id to every table that holds a person's data, with an index and a foreign key to the users table.",
        "Put all reads and writes behind one data-access layer that takes the session's user id, never an id sent from the browser.",
        "Use a migration tool (Drizzle Kit or plain SQL files) and run migrations in CI, not by hand.",
      ],
      commands: ["npm i @neondatabase/serverless drizzle-orm", "npm i -D drizzle-kit"],
      check: "A test signed in as user A gets nothing back when it asks for user B's rows by id.",
      docs: ["https://neon.com/docs/guides/cloudflare-workers"],
    },
    {
      title: "Add sign-in with Better Auth",
      detail: "Email and password with verification, plus one social login (Google) is what most consumer apps need on day one.",
      actions: [
        "Install Better Auth, point it at your Postgres with its Drizzle adapter, and generate its tables with the CLI.",
        "Mount its handler on one Next.js route (app/api/auth/[...all]/route.ts) and read the session on the server with its API.",
        "Turn on email verification and password reset, sending through Resend.",
        "Add Google sign-in; it removes the biggest drop-off at sign-up.",
        "Rate-limit sign-in, sign-up and password-reset routes (Better Auth has built-in rate limiting; check it is on in production).",
      ],
      commands: ["npm i better-auth", "npx @better-auth/cli@latest generate"],
      check: "A new user can sign up, verify their email, sign out and sign back in, and a wrong password five times in a row gets rate-limited.",
      docs: ["https://www.better-auth.com/docs/installation"],
    },
    {
      title: "Add the paid plan (skip if it's free)",
      detail: "Stripe holds the subscription; your database mirrors it from webhooks, and features are gated on the server.",
      actions: [
        "Create one Product with a monthly and a yearly Price in Stripe test mode.",
        "Create one Stripe Customer per user and store stripe_customer_id on the user row.",
        "Upgrade with a Checkout Session in subscription mode, with the user id in metadata.",
        "Link to the Stripe customer portal for cancelling, plan changes and card updates; make cancelling as easy as signing up.",
        "Handle webhooks in one route: verify the signature on the raw body, skip event ids you've already handled, then update the user's plan.",
        "Gate paid features on the mirrored plan on the server, never on a client flag or the Checkout redirect.",
      ],
      commands: ["npm i stripe", "stripe listen --forward-to localhost:8787/api/stripe/webhook"],
      check: "In test mode, a checkout unlocks the paid features, a cancel in the portal removes them at period end, and replaying the same webhook changes nothing.",
      docs: ["https://docs.stripe.com/billing/subscriptions/build-subscriptions", "https://docs.stripe.com/webhooks"],
    },
    {
      title: "Send account email from your domain",
      detail: "Sign-in email that lands in spam is a sign-up you lose.",
      actions: [
        "Verify a sending subdomain (for example mail.yourdomain.com) in Resend and add its SPF and DKIM records.",
        "Add a DMARC record for the root domain, starting at p=none with reporting.",
        "Write templates for verify email, magic link or password reset, and welcome.",
        "Let Stripe send receipts; don't duplicate them.",
        "Watch the free plan's 100 emails a day: a launch day of sign-ups passes it, so move to Pro before you announce.",
      ],
      commands: ["npm i resend @react-email/components"],
      check: "A verification email arrives in the inbox (not spam) for a Gmail and an Outlook test account.",
      docs: ["https://resend.com/docs/dashboard/domains/introduction"],
    },
    {
      title: "Keep secrets out of git",
      detail: "One copy of each secret per environment, synced to the host.",
      actions: [
        "Keep development, preview and production values in a secrets manager (Infisical) and sync production to the Worker's secrets.",
        "Use Stripe test keys everywhere except production.",
        "Add a pre-commit secret scan (gitleaks) and rotate any key that was ever committed.",
      ],
      commands: ["npx wrangler secret put BETTER_AUTH_SECRET"],
      check: "A fresh clone runs with secrets pulled from the secrets manager, and git history has no .env file.",
    },
    {
      title: "Add monitoring and analytics",
      detail: "Know when sign-up breaks, and which free users come back and upgrade.",
      actions: [
        "Install Sentry for Next.js and upload source maps in production builds.",
        "Tag Sentry events with the user id, never the email address.",
        "Add an uptime check on a /api/health route.",
        "Add PostHog with a sign-up funnel and a week-two retention chart; ask for cookie consent first for EU visitors, or use cookieless mode.",
      ],
      commands: ["npx @sentry/wizard@latest -i nextjs", "npm i posthog-js"],
      check: "A thrown test error shows up in Sentry with a readable stack trace and the user id, and no email address.",
      docs: ["https://docs.sentry.io/platforms/javascript/guides/nextjs/"],
    },
    {
      title: "Let people leave with their data",
      detail: "Consumers ask to export or delete their account; privacy laws in the EU, UK and California give them the right to.",
      actions: [
        "Add a settings page with Export my data (a JSON or CSV download) and Delete my account.",
        "Delete or anonymize every row with that user id, their uploads in storage, and the Stripe customer (after cancelling any subscription).",
        "Publish a privacy policy that lists every vendor that gets personal data (this stack: Cloudflare, Neon, Resend, Stripe, Sentry, PostHog).",
      ],
      check: "Deleting a test account leaves no rows, files or Stripe customer behind for that user.",
    },
    {
      title: "Deploy to production",
      detail: "Move to Workers Paid before launch and deploy from main.",
      actions: [
        "Switch the account to Workers Paid ($5/month): Free stops at 100,000 requests a day and allows 10 ms of CPU per request, which a server-rendered page can pass.",
        "Watch the Worker size in the deploy output: the gzip size must stay under 10 MiB on Paid (3 MiB on Free).",
        "Add your domain to the Worker as a custom domain in the Cloudflare dashboard.",
        "Deploy from CI on every push to main, with a Neon branch per pull request for previews.",
      ],
      commands: ["npm run deploy"],
      check: "The production domain serves the app over HTTPS, sign-up works end to end, and a deploy from main goes out without a manual step.",
      docs: ["https://opennext.js.org/cloudflare", "https://developers.cloudflare.com/workers/platform/pricing/"],
    },
  ],
  bestPractices: [
    "Filter every query by the signed-in user's id on the server; never trust an id from the browser.",
    "Treat Stripe as the source of truth for the paid plan and mirror it from webhooks.",
    "Make cancelling a subscription as easy as starting one, with the Stripe customer portal one click from settings.",
    "Offer Google sign-in next to email: fewer people quit at the sign-up form.",
    "Build export and delete-my-account before launch, not after the first request.",
    "Keep personal data out of logs and error reports; tag errors with the user id only.",
  ],
  pitfalls: [
    "Unlocking the paid plan on the Checkout redirect instead of on the webhook; redirects can be skipped or faked.",
    "Launching on Workers Free and hitting the 100,000-requests-a-day cap (error 1027) on the day you get shared.",
    "Using `runtime = \"edge\"` or Node middleware, which the OpenNext adapter doesn't support yet.",
    "Sending sign-in email from the free Resend plan on launch day and stopping at 100 a day.",
    "Loading analytics cookies for EU visitors before they agree.",
  ],
  complianceNotes: [
    "If the app collects personal information from children under 13 in the US, COPPA applies (parental consent first); most consumer apps set a minimum age of 13 or 16 at sign-up instead.",
    "EU and UK users have the right to see, export and delete their data, and you need a data processing agreement with each vendor that handles it.",
    "Several US states, California first, require that a subscription bought online can be cancelled online. The Stripe customer portal covers this.",
    "Keeping card entry on Stripe Checkout keeps your PCI DSS scope small; it doesn't remove it.",
    "Health, banking or other sensitive data changes the picks: describe it to recommend_stack, which checks BAAs and EU regions for each vendor.",
  ],
  catches: [
    {
      text: "Workers Free stops at 100,000 requests a day (error 1027) and allows 10 ms of CPU per request; Workers Paid is $5/month for 10M requests, then $0.30 per million. Move to Paid before launch.",
      source: "https://developers.cloudflare.com/workers/platform/pricing/",
      verifiedOn: "2026-11-09",
    },
    {
      text: "Next.js on Workers runs through the OpenNext adapter, which doesn't support the edge runtime or Node middleware yet, and the Worker's gzip size must stay under 3 MiB on Free and 10 MiB on Paid.",
      source: "https://opennext.js.org/cloudflare",
      verifiedOn: V,
    },
    {
      text: "Stripe isn't a merchant of record: registering for and filing sales tax and VAT where your customers live is yours. Paddle files it for you for 5% + 50¢ per sale.",
      source: "https://stripe.com/pricing",
      verifiedOn: "2026-11-06",
    },
    {
      text: "Resend's free plan sends 3,000 emails a month but only 100 a day, with no overage: a launch day of sign-up verifications passes it. Pro is $20/month for 50,000.",
      source: "https://resend.com/pricing",
      verifiedOn: "2026-11-06",
    },
  ],
  costOverrides: {
    "cloudflare-workers": {
      monthly: 5,
      basis: "Workers Paid from launch ($5/month, 10M requests included): Free's 10 ms of CPU per request is tight for server-rendered pages.",
    },
  },
  costNotes: [
    "At 1,000 users: about $5/month for Workers Paid; Neon, Better Auth, Sentry, PostHog and R2 stay on free plans, and Resend Free holds while sign-ups stay under 100 a day.",
    "If 100 of them pay $5 a month: Stripe takes 2.9% + 30¢ per charge ($44.50) plus 0.7% for Billing ($3.50), about $48 of the $500.",
  ],
  verifiedOn: V,
};
