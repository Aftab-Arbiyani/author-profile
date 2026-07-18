import type { MetadataRoute } from "next";
import { getBlogPosts } from "@/lib/firestore";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aftabarbiyani.com";

// Stable last-modified for the static pages. Bump this when their content
// actually changes — stamping `new Date()` on every build makes `lastmod`
// noise that crawlers learn to ignore. Blog posts use their real updatedAt.
const STATIC_LASTMOD = new Date("2026-07-18");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      // Trailing slash to match the resolved home canonical.
      url: `${BASE_URL}/`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/books/the-probationers`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/press`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  let postRoutes: MetadataRoute.Sitemap = [];

  try {
    const posts = await getBlogPosts(200);
    postRoutes = posts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      // Report the last modification date (not the publish date) so crawlers
      // re-fetch edited posts. Falls back to publishedAt, then now.
      lastModified: new Date(post.updatedAt || post.publishedAt || Date.now()),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {
    // Firestore unavailable at build time — static routes still ship
  }

  return [...staticRoutes, ...postRoutes];
}
