"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Medium-style top loading bar shown during client-side page transitions.
 *
 * App Router has no router navigation events, so this listens for clicks on
 * internal links to START the bar, then completes it when `usePathname()`
 * changes (navigation finished). Same-page hash links (#books), external
 * links, new-tab/modified clicks, and mailto: are ignored so the bar only
 * fires on real page-to-page navigation.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(false);
  const creep = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (creep.current) clearInterval(creep.current);
    if (hide.current) clearTimeout(hide.current);
    creep.current = null;
    hide.current = null;
  }

  function start() {
    clearTimers();
    setActive(true);
    setWidth(8);
    // Creep toward 90% and wait there until the route actually changes.
    creep.current = setInterval(() => {
      setWidth((w) => {
        if (w >= 90) return w;
        const step = w < 50 ? 9 : w < 75 ? 4 : 1.5;
        return Math.min(90, w + step);
      });
    }, 220);
  }

  // Navigation finished: pathname changed. Snap to 100%, then fade out.
  useEffect(() => {
    if (!active) return;
    clearTimers();
    setWidth(100);
    hide.current = setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 260);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor || !anchor.getAttribute("href")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // External (incl. mailto:, different origin) — browser handles it.
      if (url.origin !== window.location.origin) return;
      // Same page (hash-only or identical) — no route change, no loader.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      start();
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!active && width === 0) return null;

  return (
    <div
      className="routeProgress"
      style={{ width: `${width}%`, opacity: active ? 1 : 0 }}
      aria-hidden="true"
    />
  );
}
