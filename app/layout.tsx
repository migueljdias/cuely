import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { authConfigured } from "@/auth/server";
import { APP_URL, SITE_URL } from "@/site";
import "./globals.css";

// Only when both Clerk keys are set, matching proxy.ts and the account page.
const clerkOn = authConfigured();

export const metadata: Metadata = {
  metadataBase: new URL("https://cuely.dev"),
  title: "Cuely: honest stack picks for coding agents",
  description:
    "Cuely is a free MCP server your coding agent asks which tools to use and how to set them up for what you're building. No vendor pays for placement.",
  openGraph: {
    title: "Cuely: honest stack picks for coding agents",
    description: "A free MCP server that tells coding agents which tools to use, and why. No paid placement.",
    url: "https://cuely.dev",
    siteName: "Cuely",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Cuely", description: "Honest stack picks for coding agents." },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1226" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const page = (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Lets CSS hold the hero example back until it can replay; it shows anyway after 2.5s. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@500;700&family=Funnel+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        {/* Cookieless page views and Core Web Vitals, collected by Vercel. Both do nothing off Vercel. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
  // Clerk wraps the page only once its keys are set, so the site runs without them.
  return clerkOn ? (
    <ClerkProvider
      // Sign-in and the account live on app.cuely.dev; the session is shared across cuely.dev subdomains.
      signInUrl={`${APP_URL}/sign-in`}
      signUpUrl={`${APP_URL}/sign-up`}
      signInForceRedirectUrl={`${APP_URL}/account`}
      signUpForceRedirectUrl={`${APP_URL}/account`}
      afterSignOutUrl={`${SITE_URL}/`}
    >
      {page}
    </ClerkProvider>
  ) : (
    page
  );
}
