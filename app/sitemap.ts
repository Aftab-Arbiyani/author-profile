import type { MetadataRoute } from "next";
import { getBlogPosts } from "@/lib/firestore";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aftabarbiyani.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
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
