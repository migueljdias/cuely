import { authConfigured, getAuth } from "@/auth/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function forward(method: Method) {
  return (req: Request, ctx: Ctx) => {
    if (!authConfigured()) return Response.json({ error: "Accounts are not configured." }, { status: 503 });
    return getAuth().handler()[method](req, ctx);
  };
}

export const GET = forward("GET");
export const POST = forward("POST");
export const PUT = forward("PUT");
export const PATCH = forward("PATCH");
export const DELETE = forward("DELETE");
