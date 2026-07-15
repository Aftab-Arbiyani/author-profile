"use client";

import { useEffect, useState } from "react";

/**
 * Slim progress bar pinned to the top of the viewport that fills as the
 * reader scrolls through the article. A small but effective "you're making
 * progress, keep going" cue.
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, pct)));
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="readingProgress" aria-hidden>
      <div className="readingProgressBar" style={{ width: `${progress}%` }} />
    </div>
  );
}
