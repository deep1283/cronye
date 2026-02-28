import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://cronye.app",
      lastModified: new Date()
    }
  ];
}
