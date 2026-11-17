import type { Metadata } from "next";
import { ENDPOINT, KEY_PAGE, connectOptions } from "@/connect";
import { PLANS } from "@/plans";
import { ConnectTabs } from "../_components/connect-tabs";
import { SiteFooter, SiteHeader } from "../_components/chrome";
import { CopyButton } from "../_components/copy";

/**
 * What a person sees when they open https://cuely.dev/api/mcp in a browser (next.config.ts
 * rewrites browser requests there to this page). MCP clients never get it.
 */
export const metadata: Metadata = {
  title: "Connect Cuely to your AI tool",
  description: "Add Cuely's MCP server to Claude, ChatGPT, Codex, Cursor, VS Code or Claude Code.",
  robots: { index: false, follow: true },
};

export default function ConnectPage() {
  const free = PLANS.free;
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap connect-page">
        <p className="eyebrow">MCP server</p>
        <h1 className="page-title">This address is for your AI tool</h1>
        <p className="page-lede">
          Cuely tells coding agents which tools to use, and how to set them up, for what you&apos;re building. Add this
          address to your AI tool once, then ask: <q>Use Cuely to choose the stack for this.</q>
        </p>

        <div className="endpoint">
          <span className="endpoint-label">Endpoint</span>
          <code>{ENDPOINT}</code>
          <CopyButton value={ENDPOINT} />
        </div>

        <section className="connect" aria-labelledby="connect-title">
          <h2 id="connect-title" className="section-title">
            Connect in one step
          </h2>
          <ConnectTabs options={connectOptions()} />
        </section>

        <section className="panel" aria-labelledby="key-title">
          <div className="panel-head">
            <h2 id="key-title">A free account, in about 30 seconds</h2>
            <p className="muted">
              Free includes every recipe and recommendation, {free.perDay.toLocaleString("en-US")} tool calls a day and{" "}
              {free.perMinute} requests a minute.
            </p>
          </div>
          <p>The Claude and ChatGPT apps sign you in when you connect. Claude Code, Codex, Cursor and VS Code use a key from your account.</p>
          <a className="btn btn-primary" href={KEY_PAGE}>
            Get a free key
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
