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
    ];
  },
};

export default nextConfig;
