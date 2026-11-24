import { checklistMarkdown, projectChecklist } from "@/accounts/checklist";
import { getRepository } from "@/repo";
import { accountSession } from "../../../_session";

export const dynamic = "force-dynamic";

/** The project's launch checklist as a Markdown file, to commit as docs/launch-checklist.md. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, stacks } = await accountSession();
  const n = Number(id);
  const stack = stacks && Number.isInteger(n) ? await stacks.get(user.id, n) : null;
  if (!stack) return new Response("Not found", { status: 404 });
  const snap = await (await getRepository()).snapshot();
  const tools = snap.tools.filter((t) => stack.tools.includes(t.slug));
  return new Response(checklistMarkdown(stack.name, projectChecklist(stack, tools)), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'attachment; filename="launch-checklist.md"',
      "cache-control": "private, no-store",
    },
  });
}
