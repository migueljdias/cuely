import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { serverCard } from "@/mcp/server-card";
import { SERVER_INFO } from "@/mcp/server";
import { MCP_TOOLS } from "@/mcp/tool-docs";

describe("server card", () => {
  it("lists every tool with a description, and matches the registry entry", () => {
    const card = serverCard();
    expect(card.tools.map((t) => t.name).sort()).toEqual(["check_project", "compare_tools", "get_recipe", "list_categories", "recommend_stack", "start_project"]);
    for (const t of card.tools) expect(t.description?.length).toBeGreaterThan(20);
    const registry = JSON.parse(readFileSync("server.json", "utf8"));
    expect(card.serverInfo.version).toBe(registry.version);
    expect(card.description).toBe(registry.description);
    expect(card.transport.url).toBe(registry.remotes[0].url);
    expect(card.serverInfo).toBe(SERVER_INFO);
  });

  it("documents every registered tool for people, and nothing else", () => {
    const registered = serverCard().tools.map((t) => t.name).sort();
    expect(MCP_TOOLS.map((t) => t.name).sort()).toEqual(registered);
  });
});
