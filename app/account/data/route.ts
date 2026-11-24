import { accountSession } from "../_session";

export const dynamic = "force-dynamic";

/**
 * Everything Cuely keeps for the signed-in account, as one JSON file: the account record,
 * projects (with checklist ticks), API key names (never the keys or their hashes) and usage
 * counts. Sign-in details live with Clerk and are managed on the profile page.
 */
export async function GET() {
  const { user, store, account, stacks } = await accountSession();
  const [keys, usage, detail, projects] = await Promise.all([
    store ? store.listKeys(user.id) : [],
    store ? store.usage(user.id, 400) : [],
    store ? store.usageDetail(user.id, 400) : [],
    stacks ? stacks.list(user.id) : [],
  ]);
  const body = {
    exportedAt: new Date().toISOString(),
    account: account && {
      email: account.email,
      plan: account.plan,
      planStatus: account.planStatus,
      currentPeriodEnd: account.currentPeriodEnd,
      productUpdates: account.productUpdates,
      theme: account.theme,
    },
    projects: projects.map((p) => ({
      name: p.name,
      description: p.description,
      tools: p.tools,
      checklistTicks: p.checks,
      lastMarkedSeen: p.seenAt,
      createdAt: p.createdAt,
    })),
    apiKeys: keys.map((k) => ({ name: k.name, startsWith: k.prefix, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt })),
    usage: { perDay: usage, byToolAndSource: detail },
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="cuely-data.json"',
      "cache-control": "private, no-store",
    },
  });
}
