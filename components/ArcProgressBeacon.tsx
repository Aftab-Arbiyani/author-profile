"use client";

import { useEffect, useRef } from "react";

/**
 * Reports how far through a chapter the reader got, so the library can offer
 * "continue reading". Modelled on TrackView: a fire-and-forget beacon, never a
 * blocking request. Unlike TrackView there's no sessionStorage guard — the
 * upsert is idempotent, and re-reading a chapter should update the position.
 *
 * Sends on visibilitychange/pagehide rather than on scroll so a long reading
 * session costs one request, not hundreds.
 */
export function ArcProgressBeacon({
  bookSlug,
  chapterOrder,
}: {
  bookSlug: string;
  chapterOrder: number;
}) {
  // A ref, not state: scroll position changes constantly and must never
  // re-render the reader mid-sentence.
  const percentRef = useRef(0);
  const sentRef = useRef(false);

  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 100;
      percentRef.current = Math.min(100, Math.max(0, pct));
    }

    function flush() {
      if (sentRef.current) return;
      sentRef.current = true;

      fetch("/api/arc/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookSlug,
          chapterOrder,
          percent: Math.round(percentRef.current),
        }),
        keepalive: true,
      }).catch(() => {});
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      // Leaving this chapter (e.g. clicking "next chapter") also counts as a
      // read position worth saving.
      flush();
    };
  }, [bookSlug, chapterOrder]);

  return null;
}
