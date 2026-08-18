/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allowed image quality values. Next.js 16 requires any `quality` prop used
    // by next/image to be declared here (the book cover uses quality={90}).
    qualities: [90],
    // Blog cover URLs are free-form (pasted into the admin `coverUrl` field),
    // so any host must be allowed or next/image would 400 on an un-listed one.
    // Trade-off: the image optimizer will proxy/resize arbitrary remote images.
    // Acceptable for this low-traffic author site; tighten to specific hosts if
    // covers ever move to a fixed store (e.g. Firebase Storage).
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // Defence in depth for the ARC reader area. These pages read a session
  // cookie, so Next already renders them dynamically — but the manuscript is
  // unpublished work, so state it explicitly: never cache it in a shared proxy,
  // and never index it even if a page's `robots` metadata ever regresses.
  // (`/arc` itself is deliberately absent — it's a public, indexable page.)
  async headers() {
    const noStore = [
      { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];

    return [
      { source: "/arc/read/:path*", headers: noStore },
      { source: "/arc/library", headers: noStore },
      { source: "/arc/review/:path*", headers: noStore },
      { source: "/arc/signin", headers: noStore },
      { source: "/arc/verify", headers: noStore },
    ];
  },
};

export default nextConfig;
