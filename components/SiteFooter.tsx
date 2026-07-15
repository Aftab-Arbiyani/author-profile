import Link from "next/link";
import { storeUrl, AMAZON_LINK_REL } from "@/lib/amazon";
import { detectStoreCode } from "@/lib/detect-store";

/**
 * Site-wide footer: copyright line plus Blog and region-aware Amazon links.
 *
 * Self-contained async server component — it detects the visitor's Amazon
 * store from request headers itself, so pages can render `<SiteFooter />`
 * with no props. `detectStoreCode` only reads headers, so calling it again
 * here is cheap even on pages that already resolved a store code.
 */
export async function SiteFooter() {
  const storeCode = await detectStoreCode();

  return (
    <footer className="siteFooter">
      <span>(c) 2026 Aftab Arbiyani</span>
      <div className="footerLinks">
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
        <Link href="/blog">Blog</Link>
        <a
          href={storeUrl(storeCode, "B0GX33TZC3")}
          target="_blank"
          rel={AMAZON_LINK_REL}
        >
          Amazon
        </a>
        <a className="footerEmail" href="mailto:aftabarbiyani@gmail.com">
          aftabarbiyani@gmail.com
        </a>
      </div>
    </footer>
  );
}
