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
check("tools/list has 6 tools", tools.length === 6, tools.map((t) => t.name).join(", "));

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
check("list_categories lists 17", cats.structuredContent?.categories?.length === 17);

// Phone apps: Swift goes to the native recipe and Apple's push service; Expo apps keep Expo.
const swift: any = await client.callTool({
  name: "recommend_stack",
  arguments: { description: "A SwiftUI iPhone app for journaling with a yearly subscription and daily reminders", assume_defaults: true },
});
const swiftPick = (c: string) => swift.structuredContent?.stack?.find((x: any) => x.category === c);
check("a Swift iPhone app routes to native-ios-app", swift.structuredContent?.productType?.recipe === "native-ios-app");
check("it builds with Xcode Cloud and sends push through APNs", swiftPick("mobile_build")?.pick?.slug === "xcode-cloud" && swiftPick("push")?.pick?.slug === "apns-direct" && swiftPick("push")?.role === "core");
check("its answer has no Google Play fees", !/Google Play/.test(JSON.stringify(swift.structuredContent?.summary?.catches ?? [])));
const expo: any = await client.callTool({
  name: "recommend_stack",
  arguments: { description: "An iPhone and Android app that sends marketing campaigns to segments of gym members", assume_defaults: true },
});
check("a cross-platform campaign app gets Expo and OneSignal", expo.structuredContent?.productType?.recipe === "mobile-subscription-app"
  && expo.structuredContent?.stack?.find((x: any) => x.category === "push")?.pick?.slug === "onesignal");
const native: any = await client.callTool({ name: "get_recipe", arguments: { product_type: "swiftui app" } });
check("get_recipe finds the native iOS recipe by words", native.structuredContent?.recipe?.slug === "native-ios-app", `${native.structuredContent?.recipe?.steps?.length} steps`);
const start: any = await client.callTool({ name: "start_project", arguments: { description: "A SwiftUI iPhone app that sends daily reminders" } });
const ids = JSON.stringify(start.structuredContent ?? {});
check("start_project adds the iOS and push launch items", ["ios-privacy-manifest", "eu-trader-status", "push-consent"].every((id) => ids.includes(id)));

await client.close();

const page = await fetch(new URL("/", url));
const html = await page.text();
check("landing page renders", page.ok && html.includes("before your agent writes a line") && html.includes("claude mcp add"));
const llms = await fetch(new URL("/llms.txt", url));
check("llms.txt served", llms.ok && (await llms.text()).includes("recommend_stack"));

console.log(failures ? `\n${failures} check(s) failed` : "\nAll end-to-end checks passed");
process.exit(failures ? 1 : 0);
