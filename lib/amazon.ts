/**
 * Amazon storefront routing.
 *
 * The same KDP ASIN resolves across marketplaces, so region routing is just
 * a matter of swapping the domain. We detect the visitor's country from
 * Vercel's `x-vercel-ip-country` edge header (country-level accuracy is
 * ~95–99%), pick a sensible default storefront, and always let the reader
 * override it manually — detection is never 100%, and a wrong buy link
 * costs a sale.
 */

export type Marketplace = {
  /** Store code, also used as the manual-override key. */
  code: string;
  /** Amazon domain, e.g. "amazon.co.uk". */
  domain: string;
  /** Human label for the switcher. */
  label: string;
  /** Display TLD badge, e.g. ".co.uk". */
  tld: string;
};

const RAW: Omit<Marketplace, "tld">[] = [
  { code: "US", domain: "amazon.com", label: "United States" },
  { code: "GB", domain: "amazon.co.uk", label: "United Kingdom" },
  { code: "IN", domain: "amazon.in", label: "India" },
  { code: "CA", domain: "amazon.ca", label: "Canada" },
  { code: "AU", domain: "amazon.com.au", label: "Australia" },
  { code: "DE", domain: "amazon.de", label: "Germany" },
  { code: "FR", domain: "amazon.fr", label: "France" },
  { code: "IT", domain: "amazon.it", label: "Italy" },
  { code: "ES", domain: "amazon.es", label: "Spain" },
  { code: "NL", domain: "amazon.nl", label: "Netherlands" },
  { code: "JP", domain: "amazon.co.jp", label: "Japan" },
  { code: "MX", domain: "amazon.com.mx", label: "Mexico" },
  { code: "BR", domain: "amazon.com.br", label: "Brazil" },
];

export const MARKETPLACES: Marketplace[] = RAW.map((m) => ({
  ...m,
  tld: m.domain.replace(/^amazon/, ""),
}));

export const DEFAULT_STORE_CODE = "US";

/**
 * Country → storefront. Marketplaces map to themselves; nearby countries
 * without their own Amazon route to the closest store. Anything unmapped
 * falls back to the US store, which ships internationally.
 */
export const COUNTRY_TO_STORE: Record<string, string> = {
  US: "US",
  GB: "GB",
  IE: "GB",
  IN: "IN",
  CA: "CA",
  AU: "AU",
  NZ: "AU",
  DE: "DE",
  AT: "DE",
  CH: "DE",
  PL: "DE",
  CZ: "DE",
  FR: "FR",
  BE: "FR",
  LU: "FR",
  MC: "FR",
  IT: "IT",
  ES: "ES",
  PT: "ES",
  NL: "NL",
  SE: "DE",
  NO: "DE",
  DK: "DE",
  FI: "DE",
  JP: "JP",
  MX: "MX",
  BR: "BR",
};

export function storeByCode(code: string): Marketplace {
  return (
    MARKETPLACES.find((m) => m.code === code) ??
    MARKETPLACES.find((m) => m.code === DEFAULT_STORE_CODE)!
  );
}

/**
 * Amazon Associates tracking IDs, keyed by store code.
 *
 * Affiliate tags are PER-MARKETPLACE — your `amazon.com` tag earns nothing on
 * `amazon.co.uk` or `amazon.in`. Fill in ONLY the stores where you've actually
 * joined the Associates program; any store left out still gets a valid,
 * untagged link (you keep the sale, you just don't earn a commission there).
 *
 * Tags are not secret — they appear in the URL — so listing them here is fine.
 * Example shapes: US `name-20`, UK `name-21`, IN `name-21`, DE `name-21`.
 */
export const ASSOCIATE_TAGS: Record<string, string> = {
  // US: "yourtag-20",
  // GB: "yourtag-21",
  // IN: "yourtag-21",
};

export function tagFor(code: string): string | undefined {
  return ASSOCIATE_TAGS[code] || undefined;
}

export function amazonUrl(domain: string, asin: string, tag?: string): string {
  const base = `https://www.${domain}/dp/${asin}`;
  return tag ? `${base}?tag=${encodeURIComponent(tag)}` : base;
}

/** Builds the buy URL for a store code, attaching its Associates tag if set. */
export function storeUrl(code: string, asin: string): string {
  const store = storeByCode(code);
  return amazonUrl(store.domain, asin, tagFor(code));
}

/** Shared across BuyOnAmazon + AmazonLinkRewriter so a reader's manual store
 * choice is remembered and applied everywhere on the site. */
export const STORE_STORAGE_KEY = "preferredAmazonStore";
export const STORE_EVENT = "amazonStoreChange";

/**
 * Link attributes for outbound Amazon buy links. `sponsored` is Google's
 * required hint for commercial/affiliate destinations; `noopener noreferrer`
 * are the security defaults for `target="_blank"`. Used everywhere an Amazon
 * link is emitted so the markup stays consistent.
 */
export const AMAZON_LINK_REL = "sponsored noopener noreferrer";

/** Pulls the 10-char ASIN out of any Amazon product URL shape. */
const ASIN_RE = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i;

export function extractAsin(href: string): string | null {
  const match = href.match(ASIN_RE);
  return match ? match[1] : null;
}

/**
 * Rewrites a single Amazon product URL to the given storefront, preserving
 * the ASIN and dropping any tracking junk. Non-Amazon links and links with no
 * detectable ASIN are returned untouched.
 */
export function regionalizeHref(href: string, storeCode: string): string {
  if (!/amazon\./i.test(href)) return href;
  const asin = extractAsin(href);
  if (!asin) return href;
  return storeUrl(storeCode, asin);
}

/**
 * Rewrites every Amazon product link inside an HTML string (e.g. stored blog
 * content) to the given storefront AND stamps the outbound rel attribute
 * (`sponsored noopener noreferrer`) so author-pasted Amazon links inherit the
 * correct commercial-link hints without any manual markup. Runs server-side so
 * the first paint is already correct and works even with JS disabled.
 */
export function regionalizeAmazonLinks(html: string, storeCode: string): string {
  if (!html) return html;
  return html.replace(/<a\b[^>]*>/gi, (tag: string) => {
    // Only touch anchors that point at an Amazon product link.
    const hrefMatch = tag.match(/href="([^"]*amazon\.[^"]*)"/i);
    if (!hrefMatch) return tag;

    let next = tag.replace(
      /href="[^"]*"/i,
      `href="${regionalizeHref(hrefMatch[1], storeCode)}"`,
    );

    // Force the canonical commercial rel; add it if the author omitted one.
    next = /\srel="/i.test(next)
      ? next.replace(/\srel="[^"]*"/i, ` rel="${AMAZON_LINK_REL}"`)
      : next.replace(/^<a\b/i, `<a rel="${AMAZON_LINK_REL}"`);

    return next;
  });
}
