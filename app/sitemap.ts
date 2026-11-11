import type { MetadataRoute } from "next";
import { publicPaths } from "@/seo";
import { SITE_URL } from "@/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths().map((p) => ({
    url: `${SITE_URL}${p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
    ...(p.lastModified ? { lastModified: p.lastModified } : {}),
  }));
}
