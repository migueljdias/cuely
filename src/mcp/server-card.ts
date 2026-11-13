import { memoryRepository } from "@/repo";
import { createCuelyServer, INSTRUCTIONS, SERVER_INFO } from "./server";

export const MCP_ENDPOINT = "https://cuely.dev/api/mcp";

/**
 * Static description of the server at /.well-known/mcp/server-card.json, so
 * directories (Smithery, Glama and others) can list it without signing in.
 * The tool list is read from the same registrations the live server uses.
 */
export function serverCard() {
  const server = createCuelyServer({ repo: memoryRepository() });
  // The SDK keeps registrations in a private field; this reads names and descriptions only.
  const registered = (server as unknown as { _registeredTools: Record<string, { title?: string; description?: string }> })._registeredTools;
  return {
    serverInfo: SERVER_INFO,
    description: "Picks the stack, security and compliance setup for what you're building, with today's prices.",
    instructions: INSTRUCTIONS,
    transport: { type: "streamable-http", url: MCP_ENDPOINT },
    authentication: {
      required: true,
      schemes: ["oauth2"],
      metadata: "https://cuely.dev/.well-known/oauth-protected-resource/api/mcp",
      apiKey: "Or send Authorization: Bearer cuely_... with a free key from https://app.cuely.dev/account",
    },
    tools: Object.entries(registered).map(([name, t]) => ({ name, title: t.title, description: t.description })),
    repository: "https://github.com/migueljdias/cuely",
    homepage: "https://cuely.dev",
  };
}
