import type { Recipe } from "../types";

const V = "2026-11-20";

export const browserExtension: Recipe = {
  slug: "browser-extension",
  title: "Browser extension with accounts and a paid plan",
  summary:
    "A Manifest V3 extension for Chrome (and Edge and Firefox) that signs users in, talks to your own backend, and unlocks paid features after checkout on your website. All extension code ships in the package, secrets and model calls stay on your server, and the extension asks for the fewest permissions it can.",
  matches: [
    "chrome extension", "browser extension", "firefox add-on", "firefox extension", "edge extension", "safari extension", "web extension",
  ],
  fitsWhen: [
    "The product lives in the browser: it reads or changes pages, adds a side panel or popup, or works across sites.",
    "Users sign in so their settings and data follow them between browsers.",
    "You charge for a pro plan or usage.",
  ],
  notFor: [
    "A product that works as a normal website: a web app is easier to ship and update.",
    "Extensions that collect browsing history or page contents for resale: store policies forbid it.",
    "Safari-only extensions: they're built and shipped through Xcode and the App Store, which this recipe doesn't cover.",
  ],
  stack: [
    {
      category: "hosting",
      tool: "vercel",
      why: "Hosts the website (sign-in, pricing, checkout, account) and the API the extension calls. Clerk's Sync Host shares the website's sign-in with the extension.",
      alternatives: [{ tool: "cloudflare-workers", when: "The backend is a small API and the website is static." }],
    },
    {
      category: "auth",
      tool: "clerk",
      why: "Its Chrome Extension SDK signs users in inside the extension and can sync the session from your website (Sync Host), so users sign in once.",
      alternatives: [{ tool: "supabase-auth", when: "You already use Supabase for the database and will handle the extension session yourself." }],
    },
    {
      category: "database",
      tool: "neon",
      why: "Users, plans, settings and usage, behind your API; the extension never talks to the database directly.",
      alternatives: [{ tool: "supabase", when: "You want database, auth and storage from one vendor." }],
    },
    {
      category: "payments",
      tool: "stripe",
      why: "Checkout and the customer portal run on your website; the extension asks your API which plan the user has.",
      alternatives: [{ tool: "paddle", when: "You sell worldwide and want a merchant of record to handle sales tax and VAT." }],
    },
    {
      category: "monitoring",
      tool: "sentry",
      why: "Errors from the extension's service worker, popup and content scripts, plus your API, with the extension version on every event.",
      alternatives: [{ tool: "better-stack", when: "You also want uptime checks for the API." }],
    },
    {
      category: "email",
      tool: "resend",
      why: "Sign-in links, receipts and 'what's new' emails.",
      alternatives: [{ tool: "postmark", when: "Transactional deliverability matters most." }],
    },
    {
      category: "analytics",
      tool: "posthog",
      why: "Which features people use, measured from your API or the website, with no tracking of the pages users visit.",
      alternatives: [{ tool: "plausible", when: "You only want website traffic numbers." }],
      optional: true,
    },
  ],
  steps: [
    {
      title: "Scaffold a Manifest V3 extension with a build tool",
      detail: "A framework handles the manifest, reloads and per-browser builds so you write normal TypeScript and React.",
      actions: [
        "Start with Plasmo (Clerk's extension quickstart uses it) or WXT, in TypeScript.",
        "Decide the surfaces you need: popup, side panel, options page, content scripts, background service worker.",
        "Keep the website (sign-in, pricing, account) as a separate Next.js app on your own domain.",
      ],
      commands: ["npm create plasmo@latest my-extension", "npx create-next-app@latest my-extension-site --ts --app"],
      check: "The extension loads unpacked in Chrome, its popup opens, and a code change reloads it.",
      docs: ["https://docs.plasmo.com", "https://developer.chrome.com/docs/extensions/develop"],
    },
    {
      title: "Ask for the fewest permissions",
      detail: "Every permission shows a warning at install and draws more review; broad host access is the biggest one.",
      actions: [
        "Use activeTab to act on the current page after a click instead of host access to every site.",
        "If you need specific sites, list only those in host_permissions; use optional permissions for features most users won't turn on.",
        "Don't request tabs, history or all-sites access unless the core feature needs it, and say why in the listing.",
      ],
      files: [
        {
          path: "package.json (manifest section)",
          contents:
            '{\n  "manifest": {\n    "permissions": ["storage", "activeTab", "cookies"],\n    "host_permissions": ["https://your-site.com/*", "https://YOUR_CLERK_FRONTEND_API/*"],\n    "optional_host_permissions": ["https://*/*"]\n  }\n}\n',
        },
      ],
      check: "Installing the extension shows only the warnings you expect, and the core feature works with no all-sites permission.",
      docs: ["https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions"],
    },
    {
      title: "Sign users in once, on the website and in the extension",
      detail: "Users sign in on your website and the extension picks up the session.",
      actions: [
        "Add Clerk to the website, then install @clerk/chrome-extension in the extension.",
        "Turn on Sync Host so the extension reads the session from your website's domain; add that domain and Clerk's frontend API to host_permissions.",
        "Set a fixed extension key (the manifest key) so the extension id doesn't change between builds, and allow that id in Clerk.",
        "Note that Clerk's SDK doesn't fully support Sync Host in side panels yet; use a popup or options page for sign-in.",
      ],
      commands: ["npm i @clerk/chrome-extension"],
      check: "Signing in on the website makes the extension show the signed-in user without a second sign-in.",
      docs: ["https://clerk.com/docs/chrome-extension/getting-started/quickstart", "https://clerk.com/docs/guides/sessions/sync-host"],
    },
    {
      title: "Keep secrets and business logic on your backend",
      detail: "Anything in the extension package can be read by anyone who installs it.",
      actions: [
        "Put API keys (model APIs, Stripe) only on your server; the extension calls your API with the user's session token.",
        "Check the user's plan and usage limits on the server for every paid feature, never only in the extension.",
        "Ship all extension code in the package: Manifest V3 doesn't allow loading and running remotely hosted code. Fetch data and settings, not code.",
        "Validate everything content scripts send to your API; pages can tamper with them.",
      ],
      files: [
        {
          path: "site/app/api/me/route.ts",
          contents:
            'import { auth } from "@clerk/nextjs/server";\nimport { db } from "@/db";\n\n// The extension calls this with the session token to learn the user\'s plan and limits.\nexport async function GET() {\n  const { userId } = await auth();\n  if (!userId) return Response.json({ error: "signed_out" }, { status: 401 });\n  const account = await db.accountFor(userId);\n  return Response.json({ plan: account.plan, usage: account.usageThisMonth, limit: account.monthlyLimit });\n}\n',
        },
      ],
      check: "Searching the built extension for your secret keys finds nothing, and a paid feature called by a free user is refused by the API.",
      docs: ["https://developer.chrome.com/docs/extensions/develop/migrate/improve-security"],
    },
    {
      title: "Take payments on your website",
      detail: "Checkout happens on the website; the extension only reads the plan.",
      actions: [
        "Add a Stripe Checkout page for the pro plan and the customer portal for cancelling and invoices.",
        "Handle Stripe webhooks on the server to set the user's plan.",
        "In the extension, show the upgrade button as a link to your pricing page, and refresh the plan from /api/me after checkout.",
      ],
      commands: ["npm i stripe"],
      check: "Buying the pro plan on the website unlocks the paid feature in the extension within a few seconds, and cancelling in the portal locks it again at period end.",
      docs: ["https://docs.stripe.com/payments/checkout", "https://docs.stripe.com/billing/subscriptions/webhooks"],
    },
    {
      title: "Publish to the Chrome Web Store, then Edge and Firefox",
      detail: "Store review checks permissions, privacy disclosures and the listing.",
      actions: [
        "Register a Chrome Web Store developer account (a one-time $5 fee) and verify your contact email.",
        "Write the listing: what it does, screenshots, and a justification for each permission.",
        "Fill in the privacy practices form honestly and link a privacy policy that says what you collect and why.",
        "Build Edge and Firefox versions from the same code with your build tool and submit them to their stores.",
      ],
      check: "The extension is approved and installs from the store listing, and the privacy disclosures match what the code sends.",
      docs: ["https://developer.chrome.com/docs/webstore/register", "https://developer.chrome.com/docs/webstore/publish"],
    },
    {
      title: "Ship updates safely and watch errors",
      detail: "Updates go through review, and you can't hotfix code outside the package, so test before each release.",
      actions: [
        "Add Sentry to the service worker, popup and content scripts, with the extension version as the release.",
        "Keep a changelog and bump the version every release; roll out to a percentage first if the store lets you.",
        "Make the API backward compatible: older extension versions stay installed for days after an update.",
      ],
      check: "Errors show the extension version they came from, and the previous version keeps working against the new API.",
      docs: ["https://docs.sentry.io/platforms/javascript/"],
    },
  ],
  bestPractices: [
    "Request the fewest permissions; prefer activeTab and optional permissions.",
    "Keep every secret and every paid-feature check on your server.",
    "Ship all code in the package; fetch data and settings, not code.",
    "Take payments on your website and have the extension read the plan from your API.",
    "Keep your API compatible with older extension versions.",
    "Tell users plainly what page data you read and why.",
  ],
  pitfalls: [
    "Putting an API key inside the extension, where anyone can extract it.",
    "Asking for access to all sites when activeTab would do, and getting slower reviews and fewer installs.",
    "Loading scripts from your server at runtime, which Manifest V3 doesn't allow.",
    "Checking the paid plan only in the extension, so editing local storage unlocks it.",
    "Changing the API in a way that breaks extension versions users haven't updated yet.",
    "Privacy disclosures that don't match what the extension actually sends.",
  ],
  complianceNotes: [
    "Store policies require disclosing what user data you collect and limiting its use to the extension's stated purpose.",
    "Page contents and browsing data can include personal data: you need a privacy policy, and data processing agreements with vendors that see it.",
    "If users are in the EU, reading page content can count as processing personal data under GDPR; collect only what the feature needs.",
  ],
  catches: [
    {
      text: "Publishing on the Chrome Web Store needs a developer account with a one-time $5 registration fee.",
      source: "https://developer.chrome.com/docs/extensions/whats-new",
      verifiedOn: V,
    },
    {
      text: "Manifest V3 requires all of an extension's logic to be in the package; you can no longer load and execute remotely hosted code, so every code change ships as a reviewed update.",
      source: "https://developer.chrome.com/docs/extensions/develop/migrate/improve-security",
      verifiedOn: V,
    },
    {
      text: "Clerk's Chrome Extension SDK can sync sign-in from your website (Sync Host), but it doesn't fully support Sync Host in side panels yet; plan sign-in in a popup or options page.",
      source: "https://clerk.com/docs/guides/sessions/sync-host",
      verifiedOn: V,
    },
  ],
  costNotes: [
    "Store fee: $5 once for the Chrome Web Store developer account.",
    "Card fees on what you bill: 2.9% + 30¢ per charge, plus 0.7% of billing volume for Stripe Billing subscriptions.",
    "The backend is a small website and API, usually within free hosting and database plans until you have many paying users; Vercel needs Pro for a commercial product.",
  ],
  verifiedOn: V,
};
