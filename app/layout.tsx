import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { RouteProgress } from "@/components/RouteProgress";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aftabarbiyani.com",
  ),
  title: {
    default: "Aftab Arbiyani | Author of Psychological Mystery Fiction",
    template: "%s | Aftab Arbiyani",
  },
  description:
    "Aftab Arbiyani is a psychological mystery writer whose debut novel The Probationers is a snowbound abbey murder mystery about faith, exile, and secrecy.",
  authors: [{ name: "Aftab Arbiyani", url: "https://www.aftabarbiyani.com" }],
  creator: "Aftab Arbiyani",
  publisher: "Aftab Arbiyani",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    siteName: "Aftab Arbiyani",
    locale: "en_US",
    title: "Aftab Arbiyani | Author of Psychological Mystery Fiction",
    description:
      "Psychological mystery fiction about faith, exile, and the secrets people keep. Read The Probationers, a snowbound abbey murder mystery.",
    url: "/",
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Aftab Arbiyani, author of psychological mystery fiction",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aftab Arbiyani | Author of Psychological Mystery Fiction",
    description:
      "Psychological mystery fiction about faith, exile, and the secrets people keep. Read The Probationers, a snowbound abbey murder mystery.",
    images: ["/og-default.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/charter/charter_regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <RouteProgress />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
