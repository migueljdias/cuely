import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SERVER_INFO } from "@/mcp/server";

const manifest = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));

describe("server.json (MCP Registry listing)", () => {
  it("matches what the live server says about itself", () => {
    expect(manifest.version).toBe(SERVER_INFO.version);
    expect(manifest.title).toBe(SERVER_INFO.title);
    expect(manifest.websiteUrl).toBe(SERVER_INFO.websiteUrl);
    expect(manifest.remotes).toEqual([{ type: "streamable-http", url: "https://cuely.dev/api/mcp" }]);
  });

  it("fits the registry's limits", () => {
    expect(manifest.name).toMatch(/^io\.github\.migueljdias\/[a-z0-9._-]+$/);
    expect(manifest.description.length).toBeLessThanOrEqual(100);
    for (const i of manifest.icons) expect(i.src).toMatch(/^https:\/\/cuely\.dev\//);
  });
});
