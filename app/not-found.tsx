import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { BrandMark } from "@/components/BrandMark";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you were looking for could not be found.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main>
      <section className="simpleHero">
        <nav className="nav" aria-label="Primary">
          <Link className="brand" href="/">
            <BrandMark size={26} className="brandMark" />
            Aftab Arbiyani
          </Link>
          <div className="navLinks">
            <Link href="/about">About</Link>
            <Link href="/#books">Books</Link>
            <Link href="/blog">Blog</Link>
          </div>
        </nav>
        <div className="simpleHeroCopy">
          <p className="eyebrow">404</p>
          <h1>This page has gone quiet.</h1>
          <p className="lede">
            The page you were looking for doesn&apos;t exist, or has moved. Every
            mystery has a few dead ends. Let&apos;s get you back on the trail.
          </p>
          <div className="actions">
            <Link className="button" href="/">
              Back home
            </Link>
            <Link className="button secondary" href="/books/the-probationers">
              Read the book
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
