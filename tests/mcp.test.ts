import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMcpHandler, memoryUsageCounter } from "@/mcp/http";
import { memoryRepository } from "@/repo";
import { serve } from "./helpers";

const text = (r: any) => (r.content as { type: string; text: string }[]).map((c) => c.text).join("\n");

describe("MCP over Streamable HTTP", () => {
  const repo = memoryRepository();
  let srv: Awaited<ReturnType<typeof serve>>;
  let client: Client;

  beforeAll(async () => {
    srv = await serve(
      createMcpHandler({
        repo,
        keyLookup: async (k) => (k === "cuely_test" ? { keyId: 1, userId: "user_t", plan: "pro" } : null),
        countUsage: memoryUsageCounter(),
      }),
    );
    client = new Client({ name: "cuely-test", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(srv.url, { requestInit: { headers: { authorization: "Bearer cuely_test" } } }),
    );
  });
  afterAll(async () => {
    await client.close();
    await srv.close();
  });

  it("advertises the six tools, all read-only, with instructions", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["check_project", "compare_tools", "get_recipe", "list_categories", "recommend_stack", "start_project"]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
    expect(client.getInstructions()).toMatch(/recommend_stack first/);
  });

  it("names itself with a title, website and the Cuely logo", () => {
    const info = client.getServerVersion();
    expect(info?.title).toBe("Cuely");
    expect(info?.websiteUrl).toBe("https://cuely.dev");
    expect(info?.icons?.length).toBeGreaterThan(0);
    for (const i of info?.icons ?? []) expect(i.src).toMatch(/^https:\/\/cuely\.dev\//);
  });

  it("recommend_stack returns a stack and points to the recipe", async () => {
    const r: any = await client.callTool({
      name: "recommend_stack",
      arguments: { description: "I'm building a SaaS for a fintech startup" },
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.productType.recipe).toBe("b2b-saas");
    expect(r.structuredContent.status).toBe("ok");
    expect(r.structuredContent.summary.cost.text).toMatch(/at 1,000 users/);
    expect(text(r)).toMatch(/## Cost/);
    expect(text(r)).toMatch(/- Auth: WorkOS AuthKit/);
    expect(text(r)).toMatch(/get_recipe/);
  });

  it("start_project returns the stack and a checklist without asking", async () => {
    const r: any = await client.callTool({ name: "start_project", arguments: { description: "Clinic app with patient records, EU patients" } });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.status).toBe("ok");
    expect(r.structuredContent.checklist.map((c: any) => c.id)).toEqual(expect.arrayContaining(["hipaa-baas", "gdpr-dpas"]));
    expect(text(r)).toMatch(/## Stack/);
    expect(text(r)).toMatch(/- \[ \] \*\*Sign a BAA/);
    expect(repo.events.some((e) => e.tool === "start_project")).toBe(true);
  });

  it("check_project reviews a stack in use without asking questions", async () => {
    const r: any = await client.callTool({
      name: "check_project",
      arguments: { description: "A todo app for students", using: ["Cloudflare Workers", "Neon", "Not A Tool"] },
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.status).toBe("ok");
    expect(r.structuredContent.notChecked).toEqual(["Not A Tool"]);
    expect(text(r)).toMatch(/## Keep\n- Hosting: Cloudflare Workers/);
    expect(text(r)).toMatch(/## Add\n- Auth: add /);
    expect(text(r)).toMatch(/Assumed: /);
    expect(repo.events.some((e) => e.tool === "check_project")).toBe(true);
  });

  it("get_recipe returns the full B2B SaaS recipe by slug or by description", async () => {
    const bySlug: any = await client.callTool({ name: "get_recipe", arguments: { product_type: "b2b-saas" } });
    expect(bySlug.structuredContent.found).toBe(true);
    expect(text(bySlug)).toMatch(/### 4\. Add subscription billing per organization/);
    expect(text(bySlug)).toMatch(/constructEvent/);
    const byWords: any = await client.callTool({ name: "get_recipe", arguments: { product_type: "multi-tenant CRM", include_steps: false } });
    expect(byWords.structuredContent.recipe.slug).toBe("b2b-saas");
    expect(text(byWords)).not.toMatch(/## Steps/);
    const missing: any = await client.callTool({ name: "get_recipe", arguments: { product_type: "mobile game" } });
    expect(missing.structuredContent.found).toBe(false);
    expect(text(missing)).toMatch(/doesn't cover phone games/);
    const game: any = await client.callTool({ name: "get_recipe", arguments: { product_type: "daily web game with votes and streaks" } });
    expect(game.structuredContent.recipe.slug).toBe("daily-web-game");
    expect(text(game)).toMatch(/HINCRBY/);
    expect(text(game)).toMatch(/About \$5\/month at 1,000 users in tool bills/);
  });

  it("compare_tools compares within a category and errors across categories", async () => {
    const ok: any = await client.callTool({
      name: "compare_tools",
      arguments: { a: "stripe", b: "paddle", context: "selling worldwide, want VAT handled" },
    });
    expect(ok.isError).toBeFalsy();
    expect(text(ok)).toMatch(/Paddle fits better/);
    const bad: any = await client.callTool({ name: "compare_tools", arguments: { a: "stripe", b: "neon" } });
    expect(bad.isError).toBe(true);
  });

  it("list_categories lists all and expands one", async () => {
    const all: any = await client.callTool({ name: "list_categories", arguments: {} });
    expect(all.structuredContent.categories).toHaveLength(16);
    const one: any = await client.callTool({ name: "list_categories", arguments: { category: "email" } });
    expect(text(one)).toMatch(/Resend/);
    expect(text(one)).toMatch(/3,000 emails per month/);
  });

  it("rejects invalid input", async () => {
    const r: any = await client.callTool({ name: "recommend_stack", arguments: { description: "x" } });
    expect(r.isError).toBe(true);
  });

  it("logs usage per call without the description", async () => {
    await new Promise((r) => setTimeout(r, 10));
    expect(repo.events.length).toBeGreaterThan(0);
    expect(repo.events.some((e) => e.tool === "recommend_stack" && e.recipe === "b2b-saas")).toBe(true);
    expect(JSON.stringify(repo.events)).not.toMatch(/fintech startup/);
  });
});

describe("HTTP behavior", () => {
  it("answers a plain GET with server info and handles CORS preflight", async () => {
    const srv = await serve(createMcpHandler({ repo: memoryRepository() }));
    const info = await fetch(srv.url).then((r) => r.json());
    expect(info.tools).toHaveLength(6);
    expect(info.auth.oauth).toBe("https://cuely.dev/.well-known/oauth-protected-resource/api/mcp");
    const pre = await fetch(srv.url, { method: "OPTIONS" });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("*");
    await srv.close();
  });

  it("refuses a call with no credential: 401 pointing at sign-in and at the key page", async () => {
    const srv = await serve(createMcpHandler({ repo: memoryRepository(), keyLookup: async () => null }));
    const res = await fetch(srv.url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "initialize", params: {} }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://cuely.dev/.well-known/oauth-protected-resource/api/mcp", scope="profile email"',
    );
    const get = await fetch(srv.url);
    expect(get.status).toBe(401);
    expect(get.headers.get("www-authenticate")).toMatch(/resource_metadata=/);
    expect((await get.json()).tools).toHaveLength(6);
    const body = await res.json();
    expect(body.id).toBe(7);
    expect(body.error.message).toMatch(/app\.cuely\.dev\/account/);
    await srv.close();
  });
});
