import { CopyButton } from "./copy";

/**
 * Closes every catalog page: the same answer is one question away inside your agent.
 * This is where a search visitor becomes a user, so it names the exact prompt to paste.
 */
export function GuideCta({ prompt }: { prompt: string }) {
  return (
    <aside className="guide-cta" aria-labelledby="guide-cta-title">
      <h2 id="guide-cta-title">Get this answer inside your coding agent</h2>
      <p>
        Cuely is a free MCP server. Connect it to Claude, Cursor, VS Code or Claude Code in about two minutes, then ask:
      </p>
      <div className="codeblock">
        <pre>
          <code>{prompt}</code>
        </pre>
        <CopyButton value={prompt} />
      </div>
      <a className="btn btn-primary" href="/start">
        Get started free
      </a>
    </aside>
  );
}
