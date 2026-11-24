import { APP_URL, SITE_URL } from "./site";

export const ENDPOINT = `${SITE_URL}/api/mcp`;
export const KEY_PAGE = `${APP_URL}/account/keys`;

export interface ConnectOption {
  id: string;
  label: string;
  where: string;
  code: string;
}

/**
 * How to connect each client. Claude's connector signs in with OAuth on its own; the others
 * send an API key from the account page as a Bearer header, which works in every version.
 */
export function connectOptions(key = "YOUR_CUELY_KEY"): ConnectOption[] {
  return [
    {
      id: "claude",
      label: "Claude app",
      where:
        "Settings, then Connectors, then Add custom connector. Name it Cuely, paste this URL, then select Connect and sign in with Google or GitHub. No key needed.",
      code: ENDPOINT,
    },
    {
      id: "claude-code",
      label: "Claude Code",
      where: `Run once in your terminal, with your key from ${KEY_PAGE}.`,
      code: `claude mcp add --transport http cuely ${ENDPOINT} \\\n  --header "Authorization: Bearer ${key}"`,
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
      where: `Streamable HTTP. Send "Authorization: Bearer" with your key, or sign in with OAuth if your client supports it.`,
      code: ENDPOINT,
    },
  ];
}
