import type { Recipe } from "../types";

const V = "2026-11-07";

export const mobileSubscriptionApp: Recipe = {
  slug: "mobile-subscription-app",
  title: "Phone app with in-app subscriptions",
  summary:
    "An iOS and Android app with a paid subscription, built once in React Native with Expo. The stores' own in-app purchase handles payment (Apple requires it), RevenueCat wraps both stores, and Supabase is the backend: database, sign-in and storage behind row-level security.",
  matches: [
    "ios app", "android app", "iphone app", "mobile app", "phone app", "react native", "expo", "app store",
    "play store", "in-app purchase", "in-app purchases", "in-app subscription", "mobile subscription", "revenuecat",
  ],
  fitsWhen: [
    "The product is an app installed from the App Store and Google Play.",
    "Users pay you for digital features or content: a subscription, a premium tier, or one-time unlocks.",
    "You know JavaScript or React and want one codebase for both platforms.",
  ],
  notFor: [
    "Apps where users pay each other for real-world services (rides, walks, cleaning): those are paid outside in-app purchase. Use the marketplace recipe.",
    "Games with heavy 3D graphics: use a game engine instead of React Native.",
    "Apps that must work fully offline with large local data: plan local storage and sync before picking a hosted backend.",
  ],
  stack: [
    {
      category: "mobile_build",
      tool: "expo-eas",
      why: "React Native with cloud builds for both stores, store submission, and over-the-air updates for JavaScript fixes. No Mac needed to build for iOS.",
      alternatives: [
        { tool: "native-toolchains", when: "Your team already writes Swift and Kotlin, or the app leans on platform features React Native doesn't wrap." },
      ],
    },
    {
      category: "database",
      tool: "supabase",
      why: "Postgres with an API the app can call directly, protected by row-level security tied to the signed-in user, plus file storage and edge functions in the same project.",
      alternatives: [{ tool: "firebase", when: "You want an offline-first document database with Google's mobile SDKs." }],
    },
    {
      category: "auth",
      tool: "supabase-auth",
      why: "Same project and client library as the database, so row-level security can use the signed-in user's id directly. Supports Sign in with Apple, which Apple requires if you offer Google sign-in.",
      alternatives: [{ tool: "clerk", when: "You want prebuilt sign-in screens from its Expo SDK and don't mind connecting a second vendor to Supabase." }],
    },
    {
      category: "payments",
      tool: "revenuecat",
      why: "One SDK and one dashboard over Apple's and Google's in-app purchase, with entitlements, receipt checks, paywalls and webhooks to your backend. Free until $2,500 in monthly tracked revenue.",
      alternatives: [
        { tool: "stripe", when: "Only for purchases on your website, for example a US storefront link-out (App Review Guideline 3.1.1(a)). Never as checkout inside the app." },
      ],
    },
    {
      category: "email",
      tool: "resend",
      why: "Sign-in codes and receipts-style notices from your own domain once Supabase's built-in sender is too limited for production.",
      alternatives: [{ tool: "postmark", when: "Transactional deliverability and long retention matter most." }],
      optional: true,
    },
    {
      category: "monitoring",
      tool: "sentry",
      why: "Crash and error reports from both platforms with readable stack traces, including errors from over-the-air updates.",
      alternatives: [{ tool: "better-stack", when: "You also want uptime checks on your backend functions." }],
    },
    {
      category: "analytics",
      tool: "posthog",
      why: "A React Native SDK for product analytics and funnels, so you can see where people drop off before the paywall.",
      alternatives: [],
      optional: true,
    },
  ],
  steps: [
    {
      title: "Open the store accounts and create the app",
      detail:
        "Store accounts take days to approve, so start them first. Then create one Expo project that builds for both platforms.",
      actions: [
        "Enroll in the Apple Developer Program ($99 a year) and open a Google Play Console account ($25 once). Organizations need a D-U-N-S number for Apple; individuals don't.",
        "If you qualify (under $1M in App Store proceeds last calendar year, or new to the store), apply for Apple's App Store Small Business Program for the 15% rate before your first sale.",
        "Pick one bundle identifier (for example com.yourco.habits) and use it on both platforms.",
        "Create the app with Expo and link it to EAS. You need a development build, not Expo Go, because in-app purchases use native code.",
        "Commit an app.config.ts that reads environment variables, and keep secrets out of the app: anything shipped in the app binary is public.",
      ],
      commands: [
        "npx create-expo-app@latest habit-app",
        "cd habit-app && npm i -g eas-cli && eas login && eas init",
        "eas build:configure",
        "npx expo install expo-dev-client",
        "eas build --profile development --platform all",
      ],
      check: "A development build installs on a real iPhone and Android phone and loads your code from the dev server.",
      docs: ["https://docs.expo.dev/develop/development-builds/introduction/", "https://www.revenuecat.com/docs/getting-started/installation/expo", "https://developer.apple.com/programs/", "https://developer.apple.com/help/account/membership/D-U-N-S/"],
    },
    {
      title: "Set up the backend with row-level security",
      detail:
        "The app talks to Supabase directly with the public anon key, so every table must have row-level security on, with policies keyed to the signed-in user.",
      actions: [
        "Create a Supabase project. Keep the free plan while building; it pauses after a week with no activity, so move to Pro ($25/month) before launch if traffic might go quiet.",
        "Create a profiles table keyed by auth.users id, your app tables, and an entitlements table that only the server writes.",
        "Turn on row-level security on every table. Users may read and write only their own rows; entitlements are read-only to users.",
        "Store the Supabase URL and anon key in the app config. Never put the service role key in the app.",
        "Write migrations with the Supabase CLI and apply them from CI, not from the dashboard.",
      ],
      commands: ["npm i -g supabase", "supabase init", "supabase migration new init", "npx expo install @supabase/supabase-js @react-native-async-storage/async-storage"],
      files: [
        {
          path: "supabase/migrations/0001_init.sql",
          contents:
            "create table profiles (\n  id uuid primary key references auth.users(id) on delete cascade,\n  display_name text,\n  created_at timestamptz not null default now()\n);\n\ncreate table habits (\n  id uuid primary key default gen_random_uuid(),\n  user_id uuid not null references auth.users(id) on delete cascade,\n  name text not null,\n  created_at timestamptz not null default now()\n);\ncreate index on habits (user_id);\n\n-- Written only by the RevenueCat webhook (service role). The app reads it.\ncreate table entitlements (\n  user_id uuid primary key references auth.users(id) on delete cascade,\n  entitlement text not null,          -- e.g. 'pro'\n  active boolean not null,\n  expires_at timestamptz,\n  store text,                         -- 'app_store' | 'play_store' | 'stripe'\n  updated_at timestamptz not null default now()\n);\n\ncreate table revenuecat_events (       -- webhook idempotency\n  id text primary key,\n  received_at timestamptz not null default now()\n);\n\nalter table profiles enable row level security;\nalter table habits enable row level security;\nalter table entitlements enable row level security;\nalter table revenuecat_events enable row level security; -- no policies: server only\n\ncreate policy \"own profile\" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);\ncreate policy \"own habits\" on habits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);\ncreate policy \"read own entitlement\" on entitlements for select using (auth.uid() = user_id);\n",
        },
      ],
      check: "Signed in as user A, a query for user B's habits returns nothing, and an insert into entitlements from the app is refused.",
      docs: ["https://supabase.com/docs/guides/database/postgres/row-level-security", "https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native"],
    },
    {
      title: "Add sign-in, Sign in with Apple and account deletion",
      detail:
        "Both stores require in-app account deletion when the app lets people create accounts, and Apple requires an equivalent private login option if you offer Google or another social login.",
      actions: [
        "Turn on email sign-in with one-time codes, and Sign in with Apple. Add Google sign-in only alongside Apple (App Review Guideline 4.8).",
        "Use the native Apple sign-in sheet on iOS and pass its identity token to Supabase.",
        "Persist the session with AsyncStorage (or SecureStore for the refresh token) so users stay signed in.",
        "Let people use the free part of the app before an account if you can; Apple reviewers reject forced sign-up for features that don't need an account.",
        "Build Delete account in Settings: an edge function, called with the user's token, deletes their rows and the auth user with the service role key. Also publish a web page that explains how to request deletion, for Google Play's form.",
        "Deleting the account doesn't cancel a store subscription. Tell the user to cancel in their App Store or Google Play settings, and link there.",
      ],
      commands: ["npx expo install expo-apple-authentication expo-secure-store"],
      files: [
        {
          path: "supabase/functions/delete-account/index.ts",
          contents:
            'import { createClient } from "npm:@supabase/supabase-js@2";\n\nDeno.serve(async (req) => {\n  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";\n  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);\n  const { data, error } = await admin.auth.getUser(jwt);\n  if (error || !data.user) return new Response("unauthorized", { status: 401 });\n  // Rows that reference auth.users with on delete cascade go with the user.\n  const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);\n  if (delErr) return new Response("failed", { status: 500 });\n  return new Response("deleted");\n});\n',
        },
      ],
      check: "A test account can sign in with Apple, delete itself from Settings, and can no longer sign in; its rows are gone.",
      docs: [
        "https://supabase.com/docs/guides/auth/social-sign-in/auth-apple",
        "https://developer.apple.com/app-store/review/guidelines/",
        "https://support.google.com/googleplay/android-developer/answer/13327111",
      ],
    },
    {
      title: "Create the subscription in both stores and in RevenueCat",
      detail:
        "Apple and Google each hold the real products. RevenueCat maps them to one entitlement (for example pro) that your code checks.",
      actions: [
        "In App Store Connect, create a subscription group and an auto-renewable subscription (for example pro_monthly at $7.99). Subscription periods must be at least seven days (Guideline 3.1.2).",
        "In Google Play Console, create a subscription with the same product id and a base plan at the same price.",
        "Have the Account Holder accept the Paid Apps Agreement in App Store Connect, and add tax and banking details; the agreement must be active before in-app purchases work, even in sandbox testing.",
        "In RevenueCat, add both apps, connect the App Store Connect API key and the Google Play service account, create an entitlement pro, attach both products, and put them in an offering.",
        "Install the RevenueCat SDK and configure it after sign-in with the Supabase user id as the app user id, so purchases follow the account across devices.",
      ],
      commands: ["npx expo install react-native-purchases react-native-purchases-ui"],
      files: [
        {
          path: "src/purchases.ts",
          contents:
            'import { Platform } from "react-native";\nimport Purchases from "react-native-purchases";\n\n// Public SDK keys from the RevenueCat dashboard (safe to ship in the app).\nconst KEYS = { ios: process.env.EXPO_PUBLIC_RC_IOS_KEY!, android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY! };\n\nexport function configurePurchases(userId: string) {\n  Purchases.configure({ apiKey: Platform.OS === "ios" ? KEYS.ios : KEYS.android, appUserID: userId });\n}\n\nexport async function isPro(): Promise<boolean> {\n  const info = await Purchases.getCustomerInfo();\n  return info.entitlements.active["pro"] !== undefined;\n}\n\nexport async function restore(): Promise<boolean> {\n  const info = await Purchases.restorePurchases();\n  return info.entitlements.active["pro"] !== undefined;\n}\n',
        },
      ],
      check: "In a development build, the offering loads with the store's localized price on both platforms.",
      docs: [
        "https://www.revenuecat.com/docs/getting-started/installation/reactnative",
        "https://developer.apple.com/app-store/subscriptions/",
        "https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/",
      ],
    },
    {
      title: "Build a paywall the reviewers will pass",
      detail: "Most subscription rejections are about the paywall's wording, not the code.",
      actions: [
        "Say clearly what the subscriber gets, the price and the billing period before they tap subscribe (Guideline 3.1.2).",
        "Show the store's localized price string from the offering; never hard-code $7.99.",
        "Include a Restore Purchases button and links to your terms and privacy policy on the paywall.",
        "If you offer a free trial, say when it converts and what it will cost.",
        "Use RevenueCat's paywall component or your own screen; either way, unlock features only from the entitlement, never from a local flag.",
      ],
      check: "A tester who reads only the paywall can say what they'd pay, how often, and how to restore a purchase.",
      docs: ["https://developer.apple.com/app-store/subscriptions/"],
    },
    {
      title: "Mirror entitlements to the backend with a webhook",
      detail:
        "The app checks RevenueCat for the paywall, but anything the server does for paying users (sync, AI calls, exports) must check the entitlement your backend stored from the webhook.",
      actions: [
        "Add a RevenueCat webhook pointing at a Supabase edge function, with a long random Authorization header value.",
        "In the function, reject requests without that header, skip event ids already stored, and upsert the user's entitlement.",
        "Handle at least INITIAL_PURCHASE, RENEWAL, CANCELLATION (still active until expiry), EXPIRATION, BILLING_ISSUE and PRODUCT_CHANGE.",
        "On any event, you can re-fetch the subscriber from RevenueCat's API instead of trusting the payload's order.",
        "Gate server features on entitlements.active and expires_at.",
      ],
      files: [
        {
          path: "supabase/functions/revenuecat-webhook/index.ts",
          contents:
            'import { createClient } from "npm:@supabase/supabase-js@2";\n\nconst admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);\n\nDeno.serve(async (req) => {\n  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("RC_WEBHOOK_SECRET")}`) {\n    return new Response("unauthorized", { status: 401 });\n  }\n  const { event } = await req.json();\n  const { error: dup } = await admin.from("revenuecat_events").insert({ id: event.id });\n  if (dup) return new Response("ok"); // already processed\n\n  const active = !["EXPIRATION"].includes(event.type);\n  await admin.from("entitlements").upsert({\n    user_id: event.app_user_id, // the Supabase user id you passed to Purchases.configure\n    entitlement: "pro",\n    active,\n    expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,\n    store: String(event.store ?? "").toLowerCase(),\n    updated_at: new Date().toISOString(),\n  });\n  return new Response("ok");\n});\n',
        },
      ],
      check: "A sandbox purchase sets the user's entitlement to active within a minute, and its expiry clears it.",
      docs: ["https://www.revenuecat.com/docs/integrations/webhooks"],
    },
    {
      title: "Test purchases end to end",
      detail: "Both stores have test accounts that renew subscriptions quickly, so you can see a whole lifecycle in an hour.",
      actions: [
        "Create Sandbox Apple Accounts in App Store Connect and license testers in Play Console.",
        "Test buy, renew, cancel, expire, restore on a second device, and a failed payment (billing issue).",
        "Test signing in on a new phone: the subscription must follow the account through restore.",
        "Upload a build to TestFlight and Play internal testing and buy there too; that's closest to what reviewers see.",
      ],
      commands: ["eas build --profile preview --platform all"],
      check: "Every lifecycle event shows up in RevenueCat and in your entitlements table, on both platforms.",
      docs: ["https://developer.apple.com/help/app-store-connect/test-in-app-purchases/create-a-sandbox-apple-account", "https://developer.android.com/google/play/billing/test"],
    },
    {
      title: "Add crash reporting and analytics",
      detail: "Know about crashes before reviews mention them, and see where people drop off before the paywall.",
      actions: [
        "Install Sentry with its wizard and upload source maps from EAS builds and updates.",
        "Install PostHog and track a short funnel: opened, signed up, saw paywall, subscribed.",
        "Identify users by the Supabase user id only; don't send emails or names to analytics.",
        "List every SDK that collects data in the App Store privacy details and Google Play's Data safety form.",
      ],
      commands: ["npx @sentry/wizard@latest -i reactNative", "npx expo install posthog-react-native"],
      check: "A deliberate test crash appears in Sentry with a readable stack trace, and the paywall funnel shows in PostHog.",
      docs: ["https://docs.sentry.io/platforms/react-native/", "https://posthog.com/docs/libraries/react-native"],
    },
    {
      title: "Submit to both stores",
      detail: "Build production binaries in the cloud and submit them from the command line.",
      actions: [
        "Build production binaries for both platforms and submit them with EAS Submit.",
        "Give App Review a demo account and a note on where the subscription is and how to test it.",
        "Fill in App Store privacy details, Google Play's Data safety form, content rating and the account deletion web link.",
        "Personal Google Play accounts created after November 13, 2023 must run a closed test with at least 12 testers opted in for 14 days in a row before applying for production access, so start it early.",
        "Ship JavaScript-only fixes with EAS Update; anything that changes native code or what the app does needs a new store build and review.",
      ],
      commands: ["eas build --profile production --platform all", "eas submit --platform ios", "eas submit --platform android"],
      check: "Both apps are approved, and a real purchase in production unlocks pro and appears in RevenueCat.",
      docs: ["https://docs.expo.dev/deploy/submit-to-app-stores/", "https://docs.expo.dev/eas-update/introduction/", "https://support.google.com/googleplay/android-developer/answer/14151465"],
    },
    {
      title: "Optional: sell on the web too",
      detail:
        "Web purchases avoid store fees but come with rules. Do this after the in-app subscription works.",
      actions: [
        "On the US storefront, apps may include a button or link to buy on the web (Guideline 3.1.1(a)); elsewhere, don't point users from the app to outside purchase.",
        "Anything sold on the web that unlocks the app must also be available as an in-app purchase (Guideline 3.1.3(b)).",
        "Sell with Stripe Checkout on your site, grant the same pro entitlement from the Stripe webhook, and keep one entitlements table as the source of truth.",
        "On Android, external links and alternative billing need enrollment in Google's programs for eligible regions; Google Play billing stays the default.",
      ],
      check: "A web purchase unlocks pro in the app on next launch, and the in-app purchase still works.",
      docs: ["https://developer.apple.com/app-store/review/guidelines/", "https://support.google.com/googleplay/android-developer/answer/9858738"],
    },
  ],
  bestPractices: [
    "Make the store purchase the source of truth through RevenueCat, and mirror it to your backend from webhooks.",
    "Use the backend user id as RevenueCat's app user id so a subscription follows the account, not the phone.",
    "Turn on row-level security on every table before the first build ships; the anon key in the app is public.",
    "Keep the free part of the app usable without an account when you can; ask for sign-in when it adds value.",
    "Show localized prices from the store and never hard-code amounts.",
    "Plan for store review time in every release; use over-the-air updates only for JavaScript fixes.",
  ],
  pitfalls: [
    "Adding Stripe checkout inside the iOS app for a digital subscription: Apple rejects it (Guideline 3.1.1).",
    "Testing purchases in Expo Go, where native purchase code doesn't run; use a development build.",
    "Offering Google sign-in on iOS without Sign in with Apple or another equivalent private option (Guideline 4.8).",
    "Shipping without in-app account deletion; both stores require it when the app creates accounts.",
    "Unlocking features from a value saved on the phone; reinstalling or tampering bypasses it.",
    "Forgetting the Paid Apps Agreement in App Store Connect, so products never load in sandbox testing.",
    "Shipping the Supabase service role key inside the app.",
  ],
  complianceNotes: [
    "Apple's App Review Guidelines and Google Play's payments policy change often. Read the current sections on payments (Apple 3.1, Google Play payments policy) before you design the paywall.",
    "Both stores require privacy disclosures (App Store privacy details, Google Play Data safety) that match every SDK in the app, including analytics and crash reporting.",
    "Apps for children have extra rules in both stores and under laws such as COPPA in the US; this recipe doesn't cover them.",
    "If you have users in the EU or UK, you need a privacy policy that lists your vendors and data processing agreements with them.",
    "Auto-renewing subscriptions have consumer rules on disclosure and cancellation in many places; the stores handle billing and cancellation, but your paywall text is yours.",
  ],
  catches: [
    {
      text: "Apple requires in-app purchase to unlock features or subscriptions inside an iOS app (Guideline 3.1.1). On the US storefront you may also link to buy on the web (3.1.1(a)).",
      source: "https://developer.apple.com/app-store/review/guidelines/",
      verifiedOn: V,
    },
    {
      text: "Store fees: Apple takes 15% under the Small Business Program (up to $1M in proceeds the prior year); otherwise you keep 70% in a subscriber's first year and 85% after a year of paid service. Google Play takes 10% plus a 5% billing fee on auto-renewing subscriptions for the first $1M in the US, EEA, UK, Australia and Japan.",
      source: "https://developer.apple.com/app-store/subscriptions/",
      verifiedOn: V,
    },
    {
      text: "Both stores require in-app account deletion when the app lets people create accounts (Apple 5.1.1(v)); Google Play also wants a web link for deletion requests.",
      source: "https://support.google.com/googleplay/android-developer/answer/13327111",
      verifiedOn: V,
    },
    {
      text: "Supabase's free plan pauses a project after a week with no activity and allows 2 active projects; Pro is from $25 a month and isn't paused.",
      source: "https://supabase.com/pricing",
      verifiedOn: V,
    },
  ],
  costNotes: [
    "Store accounts: Apple Developer Program $99 a year (about $8.25 a month) and Google Play $25 once.",
    "Store fees come out of revenue: at 100 subscribers paying $7.99 a month ($799), about 15% ($120) goes to the stores under Apple's Small Business Program and Google Play's subscription rate.",
    "RevenueCat is free up to $2,500 in monthly tracked revenue, then 1% of what you track; its page doesn't say whether that 1% is on all tracked revenue or only the part above $2,500.",
  ],
  verifiedOn: V,
};
