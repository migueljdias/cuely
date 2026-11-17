import { APP_URL, SITE_URL } from "./site";

export const ENDPOINT = `${SITE_URL}/api/mcp`;
export const KEY_PAGE = `${APP_URL}/account`;

export interface ConnectOption {
  id: string;
  label: string;
  where: string;
  code: string;
  /** Signs in with OAuth when connecting, so no key is pasted (hidden where a key was just made). */
  oauth?: boolean;
}

/**
 * How to connect each client. The Claude and ChatGPT apps sign in with OAuth on their own (both
 * register through the Client ID Metadata Document that Clerk accepts); the others send an API key
 * from the account page as a Bearer header, which works in every version.
 */
export function connectOptions(key = "YOUR_CUELY_KEY"): ConnectOption[] {
  return [
    {
      id: "claude",
      label: "Claude app",
      where:
        "Settings, then Connectors, then Add custom connector. Name it Cuely, paste this URL, then select Connect and sign in with Google or GitHub. No key needed.",
      code: ENDPOINT,
      oauth: true,
    },
    {
      id: "chatgpt",
      label: "ChatGPT",
      where:
        "On chatgpt.com, turn on Developer mode (Settings, then Apps, then Advanced settings), then create an app. Name it Cuely, paste this URL, choose OAuth, and sign in with Google or GitHub. No key needed. Custom apps depend on your ChatGPT plan.",
      code: ENDPOINT,
      oauth: true,
    },
    {
      id: "claude-code",
      label: "Claude Code",
      where: `Run once in your terminal, with your key from ${KEY_PAGE}.`,
      code: `claude mcp add --transport http cuely ${ENDPOINT} \\\n  --header "Authorization: Bearer ${key}"`,
    },
    {
      id: "codex",
      label: "Codex",
      where:
        `Run once in your terminal, with your key from ${KEY_PAGE}. Add the export line to your shell profile so Codex finds the key in new terminals. Or skip the key: run codex mcp add with only --url, then codex mcp login cuely to sign in.`,
      code: `export CUELY_KEY=${key}\ncodex mcp add cuely --url ${ENDPOINT} --bearer-token-env-var CUELY_KEY`,
    },
    {
      id: "cursor",
      label: "Cursor",
      where: "Add to ~/.cursor/mcp.json (or .cursor/mcp.json in a project), with your key.",
      code: `{\n  "mcpServers": {\n    "cuely": {\n      "url": "${ENDPOINT}",\n      "headers": { "Authorization": "Bearer ${key}" }\n    }\n  }\n}`,
    },
    {
      id: "vscode",
      label: "VS Code",
      where: "Add to .vscode/mcp.json. VS Code asks for your key once and stores it securely.",
      code: `{\n  "inputs": [\n    { "type": "promptString", "id": "cuely-key", "description": "Cuely API key", "password": true }\n  ],\n  "servers": {\n    "cuely": {\n      "type": "http",\n      "url": "${ENDPOINT}",\n      "headers": { "Authorization": "Bearer \${input:cuely-key}" }\n    }\n  }\n}`,
    },
    {
      id: "other",
      label: "Any MCP client",
      where: `Streamable HTTP. Send "Authorization: Bearer" with your key, or sign in with OAuth if your client supports it (client ID metadata documents; dynamic registration is off).`,
      code: ENDPOINT,
    },
  ];
}
