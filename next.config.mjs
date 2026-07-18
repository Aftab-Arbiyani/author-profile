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
};

export default nextConfig;
