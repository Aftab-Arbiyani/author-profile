"use client";

import { useEffect } from "react";

/**
 * Fires a one-time "this post was read" beacon after the article mounts in a
 * real browser. Because it runs client-side (not during SSR), prefetches and
 * non-JS bots don't inflate the count. The sessionStorage guard means a reader
 * refreshing or navigating back to the same post within one browser session is
 * counted once — so the number reads as "people who read it", not raw hits.
 */
export function TrackView({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage can throw in private mode; fall through and still count.
    }

    fetch(`/api/blog/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  return null;
}
