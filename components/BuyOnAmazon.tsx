"use client";

import { useEffect, useState } from "react";
import {
  MARKETPLACES,
  storeUrl,
  STORE_STORAGE_KEY as STORAGE_KEY,
  STORE_EVENT,
  AMAZON_LINK_REL,
} from "@/lib/amazon";

type Variant = "primary" | "secondary" | "bare";

type Props = {
  asin: string;
  /** Store code detected server-side from the visitor's region. */
  initialCode: string;
  variant?: Variant;
  /** Show the manual region override dropdown + storefront badge. */
  showSwitcher?: boolean;
  label?: string;
};

/**
 * Region-aware Amazon buy link. The server renders the detected storefront on
 * first paint; the reader can override it, and the choice is remembered
 * (localStorage) and synced across every instance on the page.
 */
export function BuyOnAmazon({
  asin,
  initialCode,
  variant = "primary",
  showSwitcher = true,
  label = "Buy on Amazon",
}: Props) {
  const [code, setCode] = useState(initialCode);

  // Honor a previously chosen store, and stay in sync with other instances.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && MARKETPLACES.some((m) => m.code === saved)) {
      setCode(saved);
    }
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      if (next) setCode(next);
    };
    window.addEventListener(STORE_EVENT, onChange);
    return () => window.removeEventListener(STORE_EVENT, onChange);
  }, []);

  function choose(next: string) {
    setCode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode / storage disabled — non-fatal */
    }
    window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: next }));
  }

  const href = storeUrl(code, asin);
  const className = variant === "bare" ? undefined : `button ${variant}`;

  return (
    <span className="buyAmazon">
      <a className={className} href={href} target="_blank" rel={AMAZON_LINK_REL}>
        {label}
      </a>
      {showSwitcher ? (
        <label className="buyAmazonSwitch">
          <span className="srOnly">Choose your Amazon store</span>
          <select
            value={code}
            onChange={(e) => choose(e.target.value)}
            aria-label="Choose your Amazon store"
          >
            {MARKETPLACES.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label} ({m.tld})
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </span>
  );
}
