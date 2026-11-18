import type { Recipe } from "../types";

const V = "2026-11-18";

export const nativeIosApp: Recipe = {
  slug: "native-ios-app",
  title: "Native iPhone app in Swift",
  summary:
    "An iPhone (and iPad) app written in Swift and SwiftUI with Xcode, for teams that ship on Apple platforms only. Xcode Cloud builds every push and delivers it to TestFlight, Supabase's Swift SDK is the backend behind row-level security, Sign in with Apple is the login, in-app purchase goes through RevenueCat (or StoreKit 2 directly) when the app charges, and notifications go straight to Apple's APNs.",
  matches: [
    "swift", "swiftui", "uikit", "xcode", "native ios", "native iphone", "native ipad", "swift app", "swiftui app",
    "ios only", "iphone only", "storekit", "testflight", "xcode cloud",
  ],
  fitsWhen: [
    "The app ships on iPhone or iPad only, or Android can wait for a separate app later.",
    "You or your team write Swift, or want the platform's own UI, widgets, Live Activities, HealthKit or other Apple frameworks without a bridge.",
    "You have a Mac to write and debug the app in Xcode.",
  ],
  notFor: [
    "Apps that must launch on Android at the same time from one codebase: use the mobile-subscription-app recipe (React Native with Expo).",
    "Web developers who don't know Swift and don't own a Mac: Expo builds iOS in the cloud from React.",
    "Apps where users pay each other for real-world services: use the marketplace recipe for payments; this recipe's build, sign-in and store steps still apply.",
    "Games built in a game engine: Cuely doesn't cover engines.",
  ],
  stack: [
    {
      category: "mobile_build",
      tool: "xcode-cloud",
      why: "Apple's build service: every push is built, tested, signed and sent to TestFlight, and 25 compute hours a month come with the $99 Apple Developer Program.",
      alternatives: [
        { tool: "native-toolchains", when: "One developer shipping now and then: archive and upload from Xcode on your Mac (Product > Archive) and skip CI." },
        { tool: "expo-eas", when: "You decide to ship Android from the same code: that means React Native, not Swift." },
      ],
    },
    {
      category: "database",
      tool: "supabase",
      why: "Postgres with an official Swift SDK the app calls directly, protected by row-level security tied to the signed-in user, plus storage and edge functions for anything that needs a secret.",
      alternatives: [{ tool: "firebase", when: "You want an offline-first document database with Google's Swift SDKs, and no SQL." }],
    },
    {
      category: "auth",
      tool: "supabase-auth",
      why: "Takes the identity token from the native Sign in with Apple sheet, so sign-in is one tap and row-level security uses the same user id.",
      alternatives: [{ tool: "clerk", when: "You want hosted user management and prebuilt screens, and don't mind a second vendor next to Supabase." }],
    },
    {
      category: "payments",
      tool: "revenuecat",
      why: "Wraps StoreKit with entitlements, receipt checks, paywalls and webhooks to your backend, free until $2,500 in monthly tracked revenue. StoreKit 2 alone also works for a simple app; you then build the server checks with the App Store Server API yourself.",
      alternatives: [
        { tool: "stripe", when: "Only for purchases on your website, for example a US storefront link-out (App Review Guideline 3.1.1(a)). Never as checkout inside the app." },
      ],
    },
    {
      category: "email",
      tool: "resend",
      why: "Sign-in codes and account notices from your own domain once Supabase's built-in sender is too limited.",
      alternatives: [{ tool: "postmark", when: "Transactional deliverability and long retention matter most." }],
      optional: true,
    },
    {
      category: "push",
      tool: "apns-direct",
      why: "An iPhone-only app can send straight to Apple's APNs from an edge function with a token signing key: no push vendor, no SDK in the app, nothing to pay.",
      alternatives: [
        { tool: "firebase-cloud-messaging", when: "An Android app will follow, or the backend is already Firebase: one API for both." },
        { tool: "onesignal", when: "Non-developers will send marketing or re-engagement campaigns to segments of users." },
      ],
      optional: true,
    },
    {
      category: "monitoring",
      tool: "sentry",
      why: "Crash reports with symbolicated Swift stack traces once dSYMs are uploaded from each build.",
      alternatives: [{ tool: "better-stack", when: "You also want uptime checks on your backend functions." }],
    },
    {
      category: "analytics",
      tool: "posthog",
      why: "An iOS SDK for product analytics and funnels, without cross-app tracking, so no tracking permission prompt is needed.",
      alternatives: [],
      optional: true,
    },
  ],
  steps: [
    {
      title: "Enroll, then create the Xcode project",
      detail:
        "Apple enrollment can take days, so start it first. Uploads must be built with a current Xcode, so install it before you write code.",
      actions: [
        "Enroll in the Apple Developer Program ($99 a year). Organizations need a D-U-N-S number; individuals don't.",
        "If you qualify (under $1M in App Store proceeds last calendar year, or new to the store), apply for the App Store Small Business Program for the 15% rate before your first sale.",
        "Install Xcode 26 or later: since April 28, 2026, App Store Connect only accepts builds made with the iOS 26 SDK.",
        "Create an iOS App project with SwiftUI, set the bundle identifier you'll keep forever (com.yourcompany.app), and pick a minimum iOS version no lower than iOS 13 (required since September 9, 2026).",
        "Add Swift packages with File > Add Package Dependencies: supabase-swift, purchases-ios (RevenueCat) if the app charges, and sentry-cocoa.",
        "Commit the project to git with a .gitignore for Xcode (xcuserdata, DerivedData).",
      ],
      check: "The app runs on a simulator and on your own iPhone from Xcode, signed with your team.",
      docs: ["https://developer.apple.com/programs/", "https://developer.apple.com/news/upcoming-requirements/", "https://developer.apple.com/app-store/small-business-program/"],
    },
    {
      title: "Create the backend with row-level security",
      detail:
        "The app talks to Supabase directly with the publishable key, which anyone can read out of the app. Row-level security is what keeps one user's rows from another.",
      actions: [
        "Create a Supabase project and enable row-level security on every table before the first TestFlight build.",
        "Give every user-owned table a user_id referencing auth.users and a policy that checks auth.uid().",
        "Keep anything that needs a secret (AI calls, admin actions, webhooks) in edge functions; only the URL and publishable key go in the app.",
        "Create one SupabaseClient for the app and reuse it.",
      ],
      commands: ["npm i -g supabase", "supabase init", "supabase migration new init"],
      files: [
        {
          path: "supabase/migrations/0001_init.sql",
          contents:
            "create table notes (\n  id uuid primary key default gen_random_uuid(),\n  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),\n  body text not null,\n  created_at timestamptz not null default now()\n);\ncreate index on notes (user_id);\n\n-- Written only by the RevenueCat webhook (service role). The app reads it.\ncreate table entitlements (\n  user_id uuid primary key references auth.users(id) on delete cascade,\n  entitlement text not null,\n  active boolean not null,\n  expires_at timestamptz,\n  updated_at timestamptz not null default now()\n);\n\nalter table notes enable row level security;\nalter table entitlements enable row level security;\n\ncreate policy \"own notes\" on notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);\ncreate policy \"read own entitlement\" on entitlements for select using (auth.uid() = user_id);\n\n-- Optional: APNs device tokens, one row per device. sandbox is true for builds run from Xcode.\ncreate table push_tokens (\n  token text primary key,\n  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),\n  sandbox boolean not null default false,\n  created_at timestamptz not null default now()\n);\nalter table push_tokens enable row level security;\ncreate policy \"own push tokens\" on push_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);\n\n-- The APNs provider token, reused for 20 to 60 minutes as Apple requires. Server only: no policies.\ncreate table apns_token (id int primary key, jwt text not null, issued_at timestamptz not null);\nalter table apns_token enable row level security;\n",
        },
        {
          path: "App/Backend.swift",
          contents:
            'import Foundation\nimport Supabase\n\n// The URL and publishable key are public; never put the service role key in the app.\nlet supabase = SupabaseClient(\n  supabaseURL: URL(string: "https://YOUR-PROJECT.supabase.co")!,\n  supabaseKey: "YOUR-PUBLISHABLE-KEY"\n)\n\nstruct Note: Codable, Identifiable {\n  let id: UUID\n  let body: String\n}\n\nfunc loadNotes() async throws -> [Note] {\n  // Row-level security limits this to the signed-in user\'s rows.\n  try await supabase.from("notes").select("id, body").order("created_at", ascending: false).execute().value\n}\n',
        },
      ],
      check: "Signed in as one test user, the app can't read or write another test user's notes.",
      docs: ["https://supabase.com/docs/reference/swift/introduction", "https://supabase.com/docs/guides/database/postgres/row-level-security"],
    },
    {
      title: "Add Sign in with Apple and account deletion",
      detail:
        "Apple requires in-app account deletion when the app creates accounts (Guideline 5.1.1(v)), and an equivalent private login such as Sign in with Apple if you offer Google or another social login (4.8).",
      actions: [
        "Add the Sign in with Apple capability in Xcode and turn on the Apple provider in Supabase with your bundle identifier.",
        "Use the native SignInWithAppleButton and pass its identity token to Supabase; no web view.",
        "Let people use the parts that don't need an account before signing in (Guideline 5.1.1(v)).",
        "Add Delete Account in Settings: an edge function deletes the user's rows and the auth user with the service role key.",
        "When the account used Sign in with Apple, revoke its tokens with Apple's REST API as part of deletion, as Apple's account deletion page asks.",
        "Deleting the account doesn't cancel an App Store subscription: tell the user and link to their subscription settings.",
      ],
      files: [
        {
          path: "App/SignInView.swift",
          contents:
            'import AuthenticationServices\nimport Supabase\nimport SwiftUI\n\nstruct SignInView: View {\n  var body: some View {\n    SignInWithAppleButton(.signIn) { request in\n      request.requestedScopes = [.email, .fullName]\n    } onCompletion: { result in\n      Task {\n        guard case .success(let auth) = result,\n              let credential = auth.credential as? ASAuthorizationAppleIDCredential,\n              let tokenData = credential.identityToken,\n              let idToken = String(data: tokenData, encoding: .utf8) else { return }\n        try await supabase.auth.signInWithIdToken(\n          credentials: OpenIDConnectCredentials(provider: .apple, idToken: idToken)\n        )\n      }\n    }\n    .frame(height: 48)\n  }\n}\n',
        },
      ],
      check: "A test account signs in with Apple, deletes itself from Settings, can't sign in again, and its rows are gone.",
      docs: [
        "https://developer.apple.com/documentation/authenticationservices/implementing-user-authentication-with-sign-in-with-apple",
        "https://supabase.com/docs/guides/auth/social-sign-in/auth-apple",
        "https://developer.apple.com/support/offering-account-deletion-in-your-app/",
      ],
    },
    {
      title: "Optional: sell a subscription with in-app purchase",
      detail:
        "Digital features inside an iOS app must be sold with in-app purchase (Guideline 3.1.1). Skip this step if nothing in the app is paid.",
      actions: [
        "Have the Account Holder accept the Paid Apps Agreement and add tax and banking details in App Store Connect; products don't load, even in sandbox, until it's active.",
        "Create a subscription group and an auto-renewable subscription (for example pro_monthly); periods must be at least seven days (Guideline 3.1.2).",
        "In RevenueCat, add the app with an App Store Connect API key, create the entitlement pro and an offering, then configure the SDK after sign-in with the Supabase user id as the app user id.",
        "Or, for one simple subscription, use StoreKit 2 directly: Product.products(for:), product.purchase(), and Transaction.currentEntitlements; verify on your server with the App Store Server API.",
        "Show the store's localized price, what the subscriber gets, the billing period, Restore Purchases, and links to your terms and privacy policy on the paywall.",
        "Add a StoreKit configuration file in Xcode to test purchases, renewals and refunds locally before sandbox.",
      ],
      files: [
        {
          path: "App/Purchases.swift",
          contents:
            'import RevenueCat\n\n// The public Apple SDK key from the RevenueCat dashboard (safe to ship in the app).\nfunc configurePurchases(userId: String) {\n  Purchases.configure(withAPIKey: "appl_YOUR_PUBLIC_KEY", appUserID: userId)\n}\n\nfunc isPro() async -> Bool {\n  let info = try? await Purchases.shared.customerInfo()\n  return info?.entitlements["pro"]?.isActive == true\n}\n\nfunc restore() async -> Bool {\n  let info = try? await Purchases.shared.restorePurchases()\n  return info?.entitlements["pro"]?.isActive == true\n}\n',
        },
      ],
      check: "In a StoreKit test session and then in sandbox, buying, restoring on a second device and expiring all change what the app unlocks.",
      docs: [
        "https://developer.apple.com/storekit/",
        "https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode",
        "https://www.revenuecat.com/docs/getting-started/installation/ios",
        "https://developer.apple.com/app-store/subscriptions/",
      ],
    },
    {
      title: "Optional: mirror entitlements to the backend",
      detail:
        "The app checks RevenueCat for the paywall, but anything the server does for paying users must check the entitlement your backend stored. Skip this step if nothing in the app is paid.",
      actions: [
        "Point a RevenueCat webhook at a Supabase edge function with a long random Authorization header value.",
        "Reject requests without it, skip event ids you've already stored, and upsert the user's entitlement and expiry.",
        "Gate server features (sync limits, AI calls, exports) on the entitlements table, never on a flag the app sends.",
        "The mobile-subscription-app recipe's webhook function works unchanged for a Swift app.",
      ],
      check: "A sandbox purchase sets the user's entitlement to active within a minute, and its expiry clears it.",
      docs: ["https://www.revenuecat.com/docs/integrations/webhooks"],
    },
    {
      title: "Optional: send push notifications through APNs",
      detail:
        "Your backend signs a short-lived token with an APNs key and sends each notification to Apple over HTTP/2. The permission prompt shows once, so ask when the user turns on something that needs it.",
      actions: [
        "Add the Push Notifications capability in Xcode, and create an APNs authentication key (.p8) in Certificates, Identifiers & Profiles; store it, its key id and your team id as edge function secrets.",
        "Ask with UNUserNotificationCenter when the user turns on reminders, call registerForRemoteNotifications, and store the device token in push_tokens (sandbox for builds run from Xcode; TestFlight and App Store builds use production).",
        "Send from an edge function: an ES256 token signed with the key, reused for 20 to 60 minutes (Apple rejects tokens refreshed more often than every 20 minutes or older than an hour), POSTed to /3/device/<token> with apns-topic set to your bundle id.",
        "Delete a token when APNs answers 410; it means the app was removed or the token expired.",
        "Don't put private details in the notification text, don't make the app require notifications, and send marketing pushes only to people who opted in, with a way to opt out (Guideline 4.5.4).",
      ],
      files: [
        {
          path: "App/Push.swift",
          contents:
            'import Supabase\nimport SwiftUI\nimport UserNotifications\n\n// In your App: @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate\nfinal class AppDelegate: NSObject, UIApplicationDelegate {\n  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {\n    let token = deviceToken.map { String(format: "%02x", $0) }.joined()\n    #if DEBUG\n    let sandbox = true // builds run from Xcode use the APNs development server\n    #else\n    let sandbox = false\n    #endif\n    struct Row: Encodable { let token: String; let sandbox: Bool }\n    Task { try? await supabase.from("push_tokens").upsert(Row(token: token, sandbox: sandbox)).execute() }\n  }\n}\n\n// Call when the user turns on reminders, not at first launch.\nfunc enablePush() async -> Bool {\n  let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])) ?? false\n  if granted { await MainActor.run { UIApplication.shared.registerForRemoteNotifications() } }\n  return granted\n}\n',
        },
        {
          path: "supabase/functions/send-push/apns.ts",
          contents:
            'import { createClient } from "npm:@supabase/supabase-js@2";\nimport { importPKCS8, SignJWT } from "npm:jose@5";\n\nconst admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);\nconst TEAM_ID = Deno.env.get("APNS_TEAM_ID")!;\nconst KEY_ID = Deno.env.get("APNS_KEY_ID")!;\nconst BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID")!;\n\n// APNs wants one token reused for 20 to 60 minutes, so it lives in the database between invocations.\nasync function providerToken(): Promise<string> {\n  const { data } = await admin.from("apns_token").select("jwt, issued_at").eq("id", 1).maybeSingle();\n  if (data && Date.now() - new Date(data.issued_at).getTime() < 50 * 60_000) return data.jwt;\n  const key = await importPKCS8(Deno.env.get("APNS_PRIVATE_KEY")!, "ES256");\n  const jwt = await new SignJWT({ iss: TEAM_ID }).setProtectedHeader({ alg: "ES256", kid: KEY_ID }).setIssuedAt().sign(key);\n  await admin.from("apns_token").upsert({ id: 1, jwt, issued_at: new Date().toISOString() });\n  return jwt;\n}\n\nexport async function sendToUser(userId: string, title: string, body: string) {\n  const jwt = await providerToken();\n  const { data: tokens } = await admin.from("push_tokens").select("token, sandbox").eq("user_id", userId);\n  for (const t of tokens ?? []) {\n    const host = t.sandbox ? "api.sandbox.push.apple.com" : "api.push.apple.com";\n    const res = await fetch(`https://${host}/3/device/${t.token}`, { // Deno\'s fetch speaks HTTP/2, which APNs requires\n      method: "POST",\n      headers: { authorization: `bearer ${jwt}`, "apns-topic": BUNDLE_ID, "apns-push-type": "alert", "apns-priority": "10" },\n      body: JSON.stringify({ aps: { alert: { title, body }, sound: "default" } }),\n    });\n    if (res.status === 410) await admin.from("push_tokens").delete().eq("token", t.token); // no longer active\n  }\n}\n',
        },
      ],
      check: "A TestFlight build that turned on reminders gets a notification sent from the edge function, and deleting the app makes the next send remove its token.",
      docs: [
        "https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns",
        "https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns",
        "https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns",
      ],
    },
    {
      title: "Write the privacy manifest and decide on tracking",
      detail:
        "Since May 1, 2024, uploads need approved reasons for certain APIs, including ones called by third-party SDKs. Tracking across other companies' apps needs the user's permission (Guideline 5.1.2(i)).",
      actions: [
        "Add a PrivacyInfo.xcprivacy file to the app target and declare an approved reason for each required-reason API the app calls (UserDefaults, file timestamps, disk space, system boot time).",
        "List the data the app collects in it, and keep it in step with the App Store privacy details you'll fill in at submission.",
        "Use SDK versions that ship their own privacy manifests; Xcode merges them into the privacy report (Product > Archive, then Generate Privacy Report).",
        "If the app or an SDK links its data with other companies' data for advertising, ask with App Tracking Transparency first. Product analytics that stays with you isn't tracking, so most apps never show the prompt.",
        "Don't require tracking, notifications or location to use the app (Guideline 5.1.2(i)).",
      ],
      files: [
        {
          path: "App/PrivacyInfo.xcprivacy",
          contents:
            '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n  <key>NSPrivacyTracking</key>\n  <false/>\n  <key>NSPrivacyTrackingDomains</key>\n  <array/>\n  <key>NSPrivacyCollectedDataTypes</key>\n  <array/>\n  <key>NSPrivacyAccessedAPITypes</key>\n  <array>\n    <dict>\n      <key>NSPrivacyAccessedAPIType</key>\n      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>\n      <key>NSPrivacyAccessedAPITypeReasons</key>\n      <array>\n        <string>CA92.1</string>\n      </array>\n    </dict>\n  </array>\n</dict>\n</plist>\n',
        },
      ],
      check: "Xcode's privacy report for an archive lists every SDK, and an upload to App Store Connect raises no missing-reason warning.",
      docs: [
        "https://developer.apple.com/documentation/bundleresources/privacy-manifest-files",
        "https://developer.apple.com/app-store/user-privacy-and-data-use/",
      ],
    },
    {
      title: "Build with Xcode Cloud and test on TestFlight",
      detail: "Each push to main becomes a signed build in TestFlight, so testers always have the latest version and nobody archives by hand.",
      actions: [
        "Create the app record in App Store Connect with the same bundle identifier.",
        "In Xcode, choose Product > Xcode Cloud > Create Workflow: start on pushes to main, archive for iOS, and add a post-action for TestFlight internal testing.",
        "Add crash reporting: configure Sentry at launch and upload dSYMs from each build so stack traces are readable.",
        "If the app only uses HTTPS and Apple's built-in encryption, set ITSAppUsesNonExemptEncryption to NO in Info.plist so builds don't stop at the export compliance question.",
        "Invite up to 100 internal testers from your team; for up to 10,000 external testers, add a beta description and pass beta App Review first.",
      ],
      check: "A push to main shows up as a new build in TestFlight on a tester's phone, and a test crash appears in Sentry with Swift file names and lines.",
      docs: [
        "https://developer.apple.com/xcode-cloud/",
        "https://developer.apple.com/testflight/",
        "https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations",
        "https://docs.sentry.io/platforms/apple/",
      ],
    },
    {
      title: "Submit to the App Store",
      detail: "App Store Connect asks for several things beyond the build; missing ones block submission or get the app pulled in some regions.",
      actions: [
        "Fill in the App Store privacy details from your privacy manifest and every SDK in the app.",
        "Answer the age rating questions; the questionnaire changed with Apple's new rating system and was required for all apps by January 31, 2026.",
        "Declare your EU Digital Services Act trader status. Traders must provide an address, phone number and email that Apple shows on the product page; apps without a status were removed from the EU App Store from February 17, 2025.",
        "Give App Review a demo account, notes on where paid features are and how to test them, and a support URL.",
        "Release with phased release on so an update reaches users over seven days and can be paused.",
      ],
      check: "The app is approved and live, and a fresh install from the App Store can sign in, use the app and (if paid) buy and restore.",
      docs: [
        "https://developer.apple.com/app-store/review/guidelines/",
        "https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating",
        "https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements",
      ],
    },
  ],
  bestPractices: [
    "Keep the app's only keys public ones (Supabase URL and publishable key, RevenueCat's Apple SDK key); everything secret runs in edge functions.",
    "Turn on row-level security for every table before the first TestFlight build.",
    "Use the backend user id as RevenueCat's app user id, so a subscription follows the account, not the phone.",
    "Unlock paid features from the entitlement (RevenueCat or StoreKit's current entitlements), never from a value saved on the device.",
    "Build every push in Xcode Cloud so the build you test is the build you ship.",
    "Keep the privacy manifest, App Store privacy details and your privacy policy in step whenever you add an SDK.",
  ],
  pitfalls: [
    "Uploading a build made with an old Xcode: since April 28, 2026, App Store Connect only accepts builds made with the iOS 26 SDK.",
    "Selling digital features with Stripe or a web checkout inside the app: Apple rejects it (Guideline 3.1.1).",
    "Offering Google sign-in without Sign in with Apple or another equivalent private login (Guideline 4.8).",
    "Deleting the account in Supabase but not revoking the Sign in with Apple tokens.",
    "Forgetting the Paid Apps Agreement, so products never load in sandbox.",
    "Adding an analytics or ads SDK without updating the privacy manifest and privacy details.",
    "Shipping the Supabase service role key or any other secret inside the app bundle.",
    "Sending pushes to the production APNs server from a build run in Xcode (or the reverse): sandbox tokens only work on the development server.",
    "Making a new APNs token for every send: Apple rejects tokens refreshed more often than every 20 minutes.",
  ],
  complianceNotes: [
    "Apple's App Review Guidelines change often; read the current sections on payments (3.1), privacy (5.1) and login services (4.8) before you design sign-in and the paywall.",
    "The App Store privacy details must match what the app and every SDK in it collect, including crash reporting and analytics.",
    "Apps for children (the Kids category, or apps aimed at under-13s) have extra App Store rules and laws such as COPPA in the US; this recipe doesn't cover them.",
    "If you have users in the EU or UK, you need a privacy policy that lists your vendors and data processing agreements with them; EU traders also publish contact details on the product page under the DSA.",
    "Health, fitness or location data brings extra App Review rules (Guideline 5.1.3 for health) and may bring HIPAA or other laws; check before storing it.",
  ],
  catches: [
    {
      text: "Since April 28, 2026, apps uploaded to App Store Connect must be built with Xcode 26 or later using the iOS 26 SDK, and since September 9, 2026 they must target iOS 13 or later.",
      source: "https://developer.apple.com/news/upcoming-requirements/",
      verifiedOn: V,
    },
    {
      text: "Apple requires in-app purchase to unlock features or subscriptions inside an iOS app (Guideline 3.1.1). On the US storefront you may also link to buy on the web (3.1.1(a)).",
      source: "https://developer.apple.com/app-store/review/guidelines/",
      verifiedOn: V,
    },
    {
      text: "Since May 1, 2024, a new app or update needs approved reasons in its privacy manifest for the listed APIs it uses, including from third-party SDKs, or App Store Connect won't accept it.",
      source: "https://developer.apple.com/news/upcoming-requirements/",
      verifiedOn: V,
    },
    {
      text: "If the app supports account creation it must also offer account deletion within the app (Guideline 5.1.1(v)); apps that use Sign in with Apple should revoke the user's tokens with Apple's REST API on deletion.",
      source: "https://developer.apple.com/support/offering-account-deletion-in-your-app/",
      verifiedOn: V,
    },
    {
      text: "Every developer must declare an EU Digital Services Act trader status; apps without one were removed from the App Store in the EU from February 17, 2025, and traders' address, phone and email appear on the product page.",
      source: "https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements",
      verifiedOn: V,
    },
  ],
  costNotes: [
    "Apple Developer Program: $99 a year (about $8.25 a month), which includes 25 Xcode Cloud compute hours a month; more hours start at US$49.99 a month for 100.",
    "Store fees come out of revenue: at 100 subscribers paying $7.99 a month ($799), about 15% ($120) goes to Apple under the Small Business Program; otherwise 30% in a subscriber's first year and 15% after a year of paid service.",
    "RevenueCat is free up to $2,500 in monthly tracked revenue, then 1% of what you track. StoreKit 2 on its own has no fee beyond Apple's commission.",
  ],
  verifiedOn: V,
};
