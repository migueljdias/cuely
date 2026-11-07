import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

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
    { media: "(prefers-color-scheme: light)", color: "#f3efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0d0b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
