import type { Instrumentation } from "next";

/**
 * One structured line per unhandled server error (pages, route handlers, proxy), so failures show
 * up in Vercel's runtime logs and error view with the path and method. Request headers and bodies
 * are left out on purpose: they can carry API keys, access tokens and what users describe.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as Error & { digest?: string };
  console.error(
    JSON.stringify({
      event: "request_error",
      message: e?.message ?? String(err),
      digest: e?.digest,
      path: request.path.split("?")[0],
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      stack: e?.stack?.split("\n").slice(0, 6).join("\n"),
    }),
  );
};
