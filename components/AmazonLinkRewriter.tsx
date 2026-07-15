"use client";

import { useEffect } from "react";
import {
  MARKETPLACES,
  regionalizeHref,
  STORE_STORAGE_KEY,
  STORE_EVENT,
  AMAZON_LINK_REL,
} from "@/lib/amazon";

/**
 * Makes Amazon links inside authored content (blog posts, etc.) region-aware
 * without any special markup — just paste a normal Amazon product link.
 *
 * The server already rewrites these links to the detected storefront before
 * render, so first paint is correct. This re-applies the reader's remembered
 * manual choice (set via the homepage store switcher) and keeps links in sync
 * if they change it while reading.
 */
export function AmazonLinkRewriter({ initialCode }: { initialCode: string }) {
  useEffect(() => {
    function resolveCode(): string {
      const saved = window.localStorage.getItem(STORE_STORAGE_KEY);
      if (saved && MARKETPLACES.some((m) => m.code === saved)) return saved;
      return initialCode;
    }

    function rewrite(code: string) {
      document
        .querySelectorAll<HTMLAnchorElement>('a[href*="amazon."]')
        .forEach((a) => {
          const next = regionalizeHref(a.href, code);
          if (next !== a.href) a.href = next;
          // Keep the commercial-link hint on author-pasted Amazon links even
          // if they were injected client-side after the server rewrite.
          if (a.rel !== AMAZON_LINK_REL) a.rel = AMAZON_LINK_REL;
        });
    }

    rewrite(resolveCode());

    const onChange = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      if (code) rewrite(code);
    };
    window.addEventListener(STORE_EVENT, onChange);
    return () => window.removeEventListener(STORE_EVENT, onChange);
  }, [initialCode]);

  return null;
}
