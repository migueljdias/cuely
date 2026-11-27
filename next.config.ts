import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  // app.cuely.dev is sign-in and account only: keep every response on it out of search.
  async headers() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "app.cuely.dev" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      { source: "/api/mcp", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/connect", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
  // Saved stacks are "projects" in the app now; old links and bookmarks still land.
  async redirects() {
    return [
      { source: "/account/stacks", destination: "/account/projects", permanent: true },
      { source: "/account/stacks/:path*", destination: "/account/projects/:path*", permanent: true },
    ];
  },
  // A person opening https://cuely.dev/api/mcp in a browser gets the connect page at the same
  // address. MCP clients don't send Accept: text/html, so they reach the MCP route as before.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/mcp",
          has: [{ type: "header", key: "accept", value: ".*text/html.*" }],
          missing: [
            { type: "header", key: "mcp-protocol-version" },
            { type: "header", key: "authorization" },
          ],
          destination: "/connect",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
