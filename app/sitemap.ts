import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://cuely.dev/", changeFrequency: "weekly", priority: 1 },
    { url: "https://cuely.dev/llms.txt", changeFrequency: "weekly", priority: 0.5 },
  ];
}
