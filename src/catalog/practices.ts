/**
 * Practices: the security and compliance work a product needs, as a to-do list for
 * the start of a build. start_project picks the ones that apply from the product's
 * profile, its needs and the tools in its stack.
 *
 * Each one is a task a builder (or their coding agent) can do and check off, with
 * the standard or vendor page it comes from. They point to obligations; they never
 * promise compliance. The weekly link check (scripts/check-practices.ts) makes sure
 * every source page still loads.
 */
import type { CategorySlug, Need } from "./types";

/** What a practice can look at to decide whether it applies. */
export interface PracticeContext {
  platform: "web" | "mobile" | "both";
  money: "none" | "users_pay_you" | "users_pay_each_other";
  audience: "customers" | "internal";
  ai: boolean;
  rag: boolean;
  game: boolean;
  needs: Need[];
  /** Tool slugs in the stack (picked or already in use). */
  tools: string[];
  /** Categories the stack covers. */
  categories: CategorySlug[];
  /** The product sends push notifications (push is a core pick, not an optional one). */
  push?: boolean;
  /** An AI agent that takes actions with tools. */
  agent?: boolean;
}

export type Phase = "day_one" | "before_launch";

export type PracticeArea = "security" | "privacy" | "compliance" | "payments" | "ai" | "app_stores";

export interface Practice {
  id: string;
  area: PracticeArea;
  /** day_one: set up before the first real user data goes in. before_launch: done before real users arrive. */
  phase: Phase;
  title: string;
  /** What to do, concretely. */
  detail: string;
  /** Why it matters for this kind of product, in one sentence. */
  why: string;
  source: string;
  applies: (c: PracticeContext) => boolean;
}

const has = (c: PracticeContext, n: Need) => c.needs.includes(n);
const uses = (c: PracticeContext, slug: string) => c.tools.includes(slug);
const mobile = (c: PracticeContext) => c.platform !== "web";
const customers = (c: PracticeContext) => c.audience === "customers";
const builds = (c: PracticeContext) => c.categories.includes("database") || c.categories.includes("auth");

export const PRACTICES: Practice[] = [
  // Security: every product that stores anything.
  {
    id: "secrets-out-of-git",
    area: "security",
    phase: "day_one",
    title: "Keep keys and passwords out of the code",
    detail: "Put every API key, database URL and webhook secret in environment variables or a secrets manager, add .env files to .gitignore before the first commit, and turn on GitHub secret scanning with push protection.",
    why: "A key committed once stays in the git history, and leaked keys are found and used within minutes.",
    source: "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html",
    applies: () => true,
  },
  {
    id: "server-side-authz",
    area: "security",
    phase: "day_one",
    title: "Check who is asking on the server, for every read and write",
    detail: "Every API route and server action checks the signed-in user and that the record belongs to them (or their organization) before returning or changing it. Never trust an id sent from the browser or app on its own.",
    why: "Broken access control is the most common serious web flaw: one user reading another's data by changing an id.",
    source: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
    applies: builds,
  },
  {
    id: "supabase-rls",
    area: "security",
    phase: "day_one",
    title: "Turn on row level security for every Supabase table",
    detail: "Enable RLS on each table in an exposed schema and write a policy per table before shipping; the anon key in the browser can reach any table without one.",
    why: "Supabase exposes tables to the browser through its API, so RLS is the access check.",
    source: "https://supabase.com/docs/guides/database/postgres/row-level-security",
    applies: (c) => uses(c, "supabase") || uses(c, "supabase-auth") || uses(c, "supabase-realtime"),
  },
  {
    id: "firebase-rules",
    area: "security",
    phase: "day_one",
    title: "Write Firebase security rules before real data goes in",
    detail: "Replace test-mode rules with rules that check request.auth and the document's owner for every collection, and test them with the emulator.",
    why: "Test-mode rules let anyone read and write the whole database.",
    source: "https://firebase.google.com/docs/rules",
    applies: (c) => uses(c, "firebase"),
  },
  {
    id: "parameterized-queries",
    area: "security",
    phase: "day_one",
    title: "Never build SQL from strings",
    detail: "Use the ORM's query builder or parameterized queries everywhere; no user input pasted into SQL text.",
    why: "SQL injection lets an attacker read or delete the whole database through one form field.",
    source: "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html",
    applies: (c) => c.categories.includes("database"),
  },
  {
    id: "rate-limits",
    area: "security",
    phase: "before_launch",
    title: "Rate-limit sign-in, sign-up and anything that costs money",
    detail: "Limit attempts per IP and per account on sign-in, password reset and sign-up, and on routes that send email or call paid APIs.",
    why: "Unlimited endpoints get used for password guessing, spam sign-ups and running up your bills.",
    source: "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
    applies: (c) => customers(c) && c.categories.includes("auth"),
  },
  {
    id: "dependency-updates",
    area: "security",
    phase: "day_one",
    title: "Turn on dependency alerts",
    detail: "Enable Dependabot alerts and security updates on the repository so vulnerable packages get a pull request.",
    why: "Most apps are mostly other people's code, and known holes in it are the easiest way in.",
    source: "https://docs.github.com/en/code-security/dependabot/dependabot-security-updates/about-dependabot-security-updates",
    applies: () => true,
  },
  {
    id: "backups",
    area: "security",
    phase: "before_launch",
    title: "Know how to restore the database",
    detail: "Check the database plan's backup or point-in-time restore window, and restore once into a branch or copy to prove it works.",
    why: "A bad migration or a deleted table is only an incident if you can't get the data back.",
    source: "https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html",
    applies: (c) => c.categories.includes("database"),
  },
  {
    id: "game-scores-server",
    area: "security",
    phase: "day_one",
    title: "Accept scores only from the server's own checks",
    detail: "Validate each submitted score or streak on the server (time taken, moves, one submission per player per day) and rate-limit submissions.",
    why: "Anything the browser sends can be faked, so leaderboards fill with impossible scores.",
    source: "https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html",
    applies: (c) => c.game,
  },

  // Payments.
  {
    id: "hosted-card-entry",
    area: "payments",
    phase: "day_one",
    title: "Let the payment provider take the card details",
    detail: "Use hosted Checkout or the provider's embedded fields; card numbers never touch your server or logs.",
    why: "It keeps your PCI DSS scope to the shortest questionnaire.",
    source: "https://docs.stripe.com/security/guide",
    applies: (c) => c.money !== "none" && !mobile(c),
  },
  {
    id: "verify-webhooks",
    area: "payments",
    phase: "day_one",
    title: "Verify the signature on every payment webhook",
    detail: "Check the webhook signature with the endpoint's signing secret before acting on an event, and make handlers safe to run twice.",
    why: "An unverified webhook lets anyone mark an order paid or a subscription active.",
    source: "https://docs.stripe.com/webhooks",
    applies: (c) => c.money !== "none",
  },
  {
    id: "marketplace-kyc",
    area: "payments",
    phase: "before_launch",
    title: "Let the payment provider verify sellers before paying them out",
    detail: "Onboard sellers through the provider's connected-account flow so it collects identity and bank details and runs the required checks; don't hold or forward other people's money yourself.",
    why: "Moving money between users can need a money transmitter license unless a regulated provider does it.",
    source: "https://docs.stripe.com/connect",
    applies: (c) => c.money === "users_pay_each_other",
  },

  // Privacy: anyone with customers' personal data.
  {
    id: "privacy-policy",
    area: "privacy",
    phase: "before_launch",
    title: "Publish a privacy policy that lists your vendors",
    detail: "Say what personal data you collect, why, how long you keep it, and which vendors process it (your hosting, database, email, analytics and AI picks).",
    why: "Privacy laws in the EU and several US states require it, and app stores and payment providers ask for the link.",
    source: "https://gdpr-info.eu/art-13-gdpr/",
    applies: (c) => customers(c),
  },
  {
    id: "delete-and-export",
    area: "privacy",
    phase: "before_launch",
    title: "Let users delete their account and get a copy of their data",
    detail: "Build account deletion that removes the user's data from your database and vendors (or schedules it), and an export of what you hold about them.",
    why: "GDPR gives people the right to erasure and to their data, and Apple requires in-app account deletion.",
    source: "https://gdpr-info.eu/art-17-gdpr/",
    applies: (c) => customers(c) && (has(c, "eu") || mobile(c)),
  },
  {
    id: "no-pii-in-logs",
    area: "privacy",
    phase: "day_one",
    title: "Keep personal data out of logs, error reports and analytics",
    detail: "Turn on the error tracker's data scrubbing, don't log request bodies, and send analytics events with ids, not names, emails or content.",
    why: "Logs and analytics are copied to more vendors and kept longer than the database, and are rarely covered by the same agreements.",
    source: "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html",
    applies: (c) => customers(c) && (has(c, "eu") || has(c, "health_data") || has(c, "regulated")),
  },

  // EU.
  {
    id: "gdpr-dpas",
    area: "compliance",
    phase: "before_launch",
    title: "Have a data processing agreement with each vendor that touches personal data",
    detail: "For each pick that stores or processes users' data, accept or sign its DPA (the compliance lines in this answer say where each vendor offers one) and keep a list of them.",
    why: "GDPR Article 28 requires a contract with every processor.",
    source: "https://gdpr-info.eu/art-28-gdpr/",
    applies: (c) => has(c, "eu"),
  },
  {
    id: "eu-regions",
    area: "compliance",
    phase: "day_one",
    title: "Pick EU regions when you create the database and storage",
    detail: "Choose an EU region at creation for the database, file storage and any vector index; most can't be moved later without a migration.",
    why: "Keeping data in the EU removes most transfer questions from customers and their lawyers.",
    source: "https://gdpr-info.eu/chapter-5/",
    applies: (c) => has(c, "eu"),
  },
  {
    id: "cookie-consent",
    area: "privacy",
    phase: "before_launch",
    title: "Ask before setting analytics or ad cookies for EU visitors",
    detail: "Use cookieless analytics, or show a consent banner and load analytics and marketing scripts only after a yes. Sign-in cookies don't need consent.",
    why: "EU rules require consent for cookies that aren't strictly necessary.",
    source: "https://gdpr-info.eu/issues/consent/",
    applies: (c) => has(c, "eu") && !mobile(c) && customers(c),
  },

  // Health data (HIPAA).
  {
    id: "hipaa-baas",
    area: "compliance",
    phase: "day_one",
    title: "Sign a BAA with every vendor before patient data goes in",
    detail: "Hosting, database, auth, email, monitoring, storage and AI vendors that see patient data each need a signed business associate agreement first; many offer it only on paid plans (see the BAA lines in this answer). Keep patient data out of any tool without one.",
    why: "Sending protected health information to a vendor without a BAA is a HIPAA violation by itself.",
    source: "https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html",
    applies: (c) => has(c, "health_data"),
  },
  {
    id: "hipaa-audit-log",
    area: "compliance",
    phase: "day_one",
    title: "Log who viewed or changed each patient record",
    detail: "Write an audit row (user, record, action, time) for every read and write of patient data, and keep it where app users can't edit it.",
    why: "The HIPAA Security Rule requires audit controls on systems with patient data.",
    source: "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.312",
    applies: (c) => has(c, "health_data"),
  },
  {
    id: "hipaa-risk-and-breach",
    area: "compliance",
    phase: "before_launch",
    title: "Write a risk assessment and a breach plan",
    detail: "List where patient data lives and what could expose it, and write down who does what if it leaks, including notice to affected people within 60 days.",
    why: "HIPAA requires a risk analysis, and the Breach Notification Rule sets the deadlines.",
    source: "https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html",
    applies: (c) => has(c, "health_data"),
  },

  // Business customers.
  {
    id: "b2b-tenant-isolation",
    area: "security",
    phase: "day_one",
    title: "Put the organization id on every row and every query",
    detail: "Every table with customer data has an organization column, and every query filters on the signed-in user's organization (or a database policy enforces it).",
    why: "One customer seeing another's data ends the business relationship, and it's the first thing security reviews test.",
    source: "https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html",
    applies: (c) => has(c, "b2b"),
  },
  {
    id: "b2b-audit-sso",
    area: "compliance",
    phase: "before_launch",
    title: "Be ready for the security questionnaire",
    detail: "Keep an audit log of admin actions, offer SSO and roles (your auth pick's add-ons), and write a one-page security overview listing your vendors and their SOC 2 reports.",
    why: "Business buyers send a security questionnaire before signing, and SOC 2 is an audit of your company, not your vendors.",
    source: "https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2",
    applies: (c) => has(c, "b2b") || has(c, "regulated"),
  },
  {
    id: "internal-sso",
    area: "security",
    phase: "day_one",
    title: "Restrict the tool to your company's accounts",
    detail: "Sign in with the company's Google Workspace or Microsoft accounts only, and remove access when someone leaves.",
    why: "Staff tools hold the most sensitive data and are the easiest to forget about.",
    source: "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
    applies: (c) => c.audience === "internal",
  },

  // AI.
  {
    id: "ai-keys-server",
    area: "ai",
    phase: "day_one",
    title: "Call the model API only from your server",
    detail: "Keep the model API key on the server, never in browser or app code, and set a monthly spend limit in the provider's console.",
    why: "A key in the client gets copied and runs up the bill.",
    source: "https://genai.owasp.org/llm-top-10/",
    applies: (c) => c.ai,
  },
  {
    id: "ai-usage-caps",
    area: "ai",
    phase: "before_launch",
    title: "Cap AI usage per user",
    detail: "Limit requests or tokens per user per day, and cap the input size you send to the model.",
    why: "One user or bot can spend a month's budget in an afternoon.",
    source: "https://genai.owasp.org/llmrisk/llm102025-unbounded-consumption/",
    applies: (c) => c.ai,
  },
  {
    id: "ai-prompt-injection",
    area: "ai",
    phase: "day_one",
    title: "Treat text from users and documents as untrusted input to the model",
    detail: "Don't give the model tools or data the current user couldn't use themselves, check its output before acting on it, and keep system instructions separate from user content.",
    why: "Prompt injection makes a model ignore its instructions and leak data or take actions.",
    source: "https://genai.owasp.org/llmrisk/llm01-prompt-injection/",
    applies: (c) => c.ai,
  },
  {
    id: "rag-tenant-filter",
    area: "ai",
    phase: "day_one",
    title: "Filter every document search by the user's organization",
    detail: "Store the organization id with every chunk and filter on it in every vector query, so answers only use documents the user may see.",
    why: "Without the filter, the model quotes one customer's documents to another.",
    source: "https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/",
    applies: (c) => c.rag,
  },

  // App stores.
  {
    id: "mobile-no-secrets",
    area: "app_stores",
    phase: "day_one",
    title: "Ship no secret keys in the app",
    detail: "Only publishable keys go in the app bundle; anything secret (payments, AI, admin database access) stays behind your backend or the database's access rules.",
    why: "Anyone can unpack an app and read every string in it.",
    source: "https://mas.owasp.org/MASVS/",
    applies: mobile,
  },
  {
    id: "store-privacy-forms",
    area: "app_stores",
    phase: "before_launch",
    title: "Fill in the stores' privacy forms from your vendor list",
    detail: "Apple's privacy details and Google Play's data safety form must list the data each SDK in the app collects (analytics, crash reporting, sign-in).",
    why: "Wrong or missing answers get an app rejected or pulled.",
    source: "https://support.google.com/googleplay/android-developer/answer/10787469",
    applies: mobile,
  },
  {
    id: "ios-privacy-manifest",
    area: "app_stores",
    phase: "before_launch",
    title: "Add an iOS privacy manifest with approved reasons",
    detail: "Add PrivacyInfo.xcprivacy to the iOS app (Expo: ios.privacyManifests in app config) with an approved reason for each required-reason API the app or its SDKs call, such as UserDefaults and file timestamps, and use SDK versions that ship their own manifests.",
    why: "Since May 1, 2024, App Store Connect doesn't accept a new app or update without approved reasons for those APIs, including ones used by third-party SDKs.",
    source: "https://developer.apple.com/documentation/bundleresources/privacy-manifest-files",
    applies: mobile,
  },
  {
    id: "ios-tracking-permission",
    area: "privacy",
    phase: "before_launch",
    title: "Ask before tracking, or don't track",
    detail: "If the app or an SDK links its data with other companies' data for advertising or shares it with data brokers, ask with App Tracking Transparency first and set NSPrivacyTracking in the privacy manifest. Analytics you keep to yourself isn't tracking. Don't make the app's features depend on saying yes.",
    why: "Apple requires explicit permission through App Tracking Transparency to track users (Guideline 5.1.2(i)), and apps that track without it are rejected.",
    source: "https://developer.apple.com/app-store/user-privacy-and-data-use/",
    applies: (c) => mobile(c) && customers(c),
  },
  {
    id: "push-consent",
    area: "app_stores",
    phase: "before_launch",
    title: "Ask for notifications in context, and opt in to marketing pushes",
    detail: "Ask for notification permission when the user turns on something that needs it, keep the app usable without it, keep private details out of the notification text, and send promotional pushes only to people who opted in through consent text in the app, with an in-app way to opt out.",
    why: "App Review Guideline 4.5.4 says push must not be required for the app to work, shouldn't carry sensitive information, and needs explicit opt-in for promotions or marketing.",
    source: "https://developer.apple.com/app-store/review/guidelines/",
    applies: (c) => mobile(c) && !!c.push,
  },
  {
    id: "eu-trader-status",
    area: "app_stores",
    phase: "before_launch",
    title: "Declare your EU trader status in App Store Connect",
    detail: "Declare whether you're a trader under the EU Digital Services Act. A trader (anyone selling or running the app as a business) gives Apple an address, phone number and email to show on the App Store product page.",
    why: "Apps without a trader status were removed from the App Store in the EU from February 17, 2025, and new apps ask for it at submission.",
    source: "https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements",
    applies: (c) => mobile(c) && customers(c),
  },
  {
    id: "sms-consent",
    area: "compliance",
    phase: "before_launch",
    title: "Get consent before texting people, and honor STOP",
    detail: "Collect a clear opt-in (a checkbox that says what you'll text and how often) before sending any automated text, store when and how each person agreed, and stop texting the moment someone replies STOP or opts out another way.",
    why: "FCC rules require consent for autodialed texts (written consent for marketing texts), and people can opt out at any time in any reasonable manner.",
    source: "https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts",
    applies: (c) => c.categories.includes("sms"),
  },
  {
    id: "agent-least-privilege",
    area: "ai",
    phase: "day_one",
    title: "Give the agent the fewest permissions it needs, and ask a person before risky actions",
    detail: "Give each tool its own narrowly scoped credentials (read-only where possible, one user's data only), and require a person to approve actions that send, pay, delete or publish. Treat web pages, emails and files the agent reads as data that may contain instructions, never as commands.",
    why: "Instructions hidden in a web page or file can steer an agent (indirect prompt injection), and the damage is limited by what its tools are allowed to do.",
    source: "https://genai.owasp.org/llmrisk/llm01-prompt-injection/",
    applies: (c) => !!c.agent,
  },
];

const PHASE_ORDER: Phase[] = ["day_one", "before_launch"];
const AREA_ORDER: PracticeArea[] = ["compliance", "security", "payments", "privacy", "ai", "app_stores"];

/** The practices that apply, day-one work first, then by area. */
export function practicesFor(c: PracticeContext): Practice[] {
  return PRACTICES.filter((p) => p.applies(c)).sort(
    (a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) || AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area),
  );
}
