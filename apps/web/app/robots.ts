import type { MetadataRoute } from "next";

const BASE_URL = "https://care-log.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/pricing",
          "/carezone-alternative",
          "/for-referrers",
          "/about",
          "/contact",
          "/trust",
          "/privacy",
          "/terms",
        ],
        disallow: ["/api/", "/_next/", "/(app)/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
