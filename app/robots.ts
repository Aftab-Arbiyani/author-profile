import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aftabarbiyani.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // `/arc` itself stays crawlable — it's a public landing page. Everything
        // behind the reader session is disallowed: the manuscript must never be
        // indexed, and sign-in/verify pages have no search value.
        disallow: [
          "/admin/",
          "/api/",
          "/arc/library",
          "/arc/read/",
          "/arc/review/",
          "/arc/signin",
          "/arc/verify",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
