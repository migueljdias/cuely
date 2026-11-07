/**
 * End-to-end check: connects to a running Cuely with the official MCP client
 * and calls every tool. Usage: CUELY_URL=http://localhost:3000/api/mcp [CUELY_KEY=cuely_...] npm run e2e
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL(process.env.CUELY_URL ?? "http://localhost:3000/api/mcp");
let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};
const text = (r: any) => (r.content as { text: string }[]).map((c) => c.text).join("\n");

const client = new Client({ name: "cuely-e2e", version: "1.0.0" });
const key = process.env.CUELY_KEY;
await client.connect(
  new StreamableHTTPClientTransport(url, key ? { requestInit: { headers: { authorization: `Bearer ${key}` } } } : undefined),
);
check("initialize", client.getServerVersion()?.name === "cuely", JSON.stringify(client.getServerVersion()));

const { tools } = await client.listTools();
check("tools/list has 4 tools", tools.length === 4, tools.map((t) => t.name).join(", "));

const rec: any = await client.callTool({
  name: "recommend_stack",
  arguments: { description: "I'm trying to create a SaaS for a fintech startup" },
});
const stack = rec.structuredContent?.stack ?? [];
check("recommend_stack returns 10 categories", stack.length === 10);
check("recommend_stack routes to the b2b-saas recipe", rec.structuredContent?.productType?.recipe === "b2b-saas");
console.log("\n" + text(rec).split("\n").slice(0, 12).join("\n") + "\n  ...\n");

const recipe: any = await client.callTool({ name: "get_recipe", arguments: { product_type: "b2b-saas" } });
check("get_recipe returns 10 steps", recipe.structuredContent?.recipe?.steps?.length === 10);

const cmp: any = await client.callTool({
  name: "compare_tools",
  arguments: { a: "Clerk", b: "WorkOS", context: "B2B SaaS that will need enterprise SSO" },
});
check("compare_tools gives a verdict", /fits better/.test(text(cmp)), cmp.structuredContent?.verdict);

const cats: any = await client.callTool({ name: "list_categories", arguments: {} });
check("list_categories lists 10", cats.structuredContent?.categories?.length === 10);

await client.close();

const page = await fetch(new URL("/", url));
const html = await page.text();
check("landing page renders", page.ok && html.includes("second opinion") && html.includes("claude mcp add"));
const llms = await fetch(new URL("/llms.txt", url));
check("llms.txt served", llms.ok && (await llms.text()).includes("recommend_stack"));

console.log(failures ? `\n${failures} check(s) failed` : "\nAll end-to-end checks passed");
process.exit(failures ? 1 : 0);
