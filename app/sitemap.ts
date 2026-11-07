import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://cuely.dev/", changeFrequency: "weekly", priority: 1 },
    { url: "https://cuely.dev/pricing", changeFrequency: "monthly", priority: 0.6 },
    { url: "https://cuely.dev/llms.txt", changeFrequency: "weekly", priority: 0.5 },
    { url: "https://cuely.dev/privacy", changeFrequency: "yearly", priority: 0.2 },
    { url: "https://cuely.dev/terms", changeFrequency: "yearly", priority: 0.2 },
  ];
}
