import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://cronye.app",
      lastModified: new Date()
    },
    {
      url: "https://cronye.app/checkout",
      lastModified: new Date()
    },
    {
      url: "https://cronye.app/recover",
      lastModified: new Date()
    }
  ];
}
