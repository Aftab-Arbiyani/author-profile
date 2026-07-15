import Link from "next/link";
import type { Metadata } from "next";
import { BuyOnAmazon } from "@/components/BuyOnAmazon";
import { SiteFooter } from "@/components/SiteFooter";
import { BrandMark } from "@/components/BrandMark";
import { detectStoreCode } from "@/lib/detect-store";
import { jsonLdScript } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "About",
  description:
    "Aftab Arbiyani is a psychological mystery writer and software engineer based in India, and the author of the debut novel The Probationers.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Aftab Arbiyani",
    description:
      "Psychological mystery writer and software engineer based in India, author of the debut novel The Probationers.",
    url: "/about",
    type: "profile",
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
    title: "About Aftab Arbiyani",
    description:
      "Psychological mystery writer and software engineer based in India, author of the debut novel The Probationers.",
    images: ["/og-default.jpg"],
  },
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://www.aftabarbiyani.com/#person",
  name: "Aftab Arbiyani",
  url: "https://www.aftabarbiyani.com",
  jobTitle: "Author",
  description:
    "Aftab Arbiyani is a psychological mystery writer and software engineer based in India, author of the debut novel The Probationers.",
  sameAs: ["https://www.amazon.com/dp/B0GX33TZC3"],
  alumniOf: {
    "@type": "CollegeOrUniversity",
    name: "Government Engineering College, Bhavnagar",
  },
  knowsAbout: [
    "Psychological mystery fiction",
    "Murder mystery novels",
    "Backend software engineering",
  ],
};

const profilePageJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": "https://www.aftabarbiyani.com/about",
  url: "https://www.aftabarbiyani.com/about",
  name: "About Aftab Arbiyani",
  mainEntity: { "@id": "https://www.aftabarbiyani.com/#person" },
  isPartOf: { "@id": "https://www.aftabarbiyani.com/#website" },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://www.aftabarbiyani.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "About",
      item: "https://www.aftabarbiyani.com/about",
    },
  ],
};

export default async function AboutPage() {
  const storeCode = await detectStoreCode();

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(profilePageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
      />

      <section className="simpleHero">
        <nav className="nav" aria-label="Primary">
          <Link className="brand" href="/">
            <BrandMark size={26} className="brandMark" />
            Aftab Arbiyani
          </Link>
          <div className="navLinks">
            <Link href="/about" aria-current="page">
              About
            </Link>
            <Link href="/#books">Books</Link>
            <Link href="/blog">Blog</Link>
          </div>
        </nav>
        <div className="simpleHeroCopy">
          <p className="eyebrow">About</p>
          <h1>About Aftab Arbiyani</h1>
          <p className="lede">
            Psychological mystery fiction, written by an engineer who has always
            been drawn to closed systems and the secrets they keep.
          </p>
        </div>
      </section>

      <section className="section">
        <div>
          <p className="eyebrow">The writer</p>
          <h2>Engineer by day, mystery writer by night.</h2>
        </div>
        <div className="prose">
          <p>
            Aftab Arbiyani is a software engineer and technical lead based in
            India, who spends his days architecting systems and his nights
            building the kind of puzzles that can&apos;t be solved with code.
          </p>
          <p>
            He has spent more than five years designing and building large-scale
            backend systems, and today leads engineering work at SolGuruz. He
            studied Computer Engineering at Government Engineering College,
            Bhavnagar.
          </p>
          <p>
            The same instincts that make good software (closed systems, hidden
            logic, and the way a single constraint changes everything
            downstream) are the ones he brings to a locked-room mystery.
          </p>
          <p>He writes for readers who believe a mystery should earn its ending.</p>
        </div>
      </section>

      <section className="section">
        <div>
          <p className="eyebrow">The book</p>
          <h2>The Probationers</h2>
        </div>
        <div className="prose">
          <p>
            His debut novel is a murder mystery set inside a snowbound Benedictine
            monastery in the Umbrian hills, where six novices, one body, and
            sixty-four years of buried secrets converge. It draws on his long
            fascination with closed systems, hidden logic, and the question of
            what a person will do to stay inside the life they have built for
            themselves.
          </p>
          <p>
            At the Abbazia di San Gerolamo, the Great Silence should protect the
            life of the community. Instead, it hides a murder. Sister Aude Bellamy
            arrives to separate accident from intention, obedience from fear, and
            confession from survival.
          </p>
          <div className="actions">
            <BuyOnAmazon
              asin="B0GX33TZC3"
              initialCode={storeCode}
              variant="primary"
              showSwitcher={false}
              label="Read The Probationers"
            />
            <Link className="button secondary" href="/#books">
              View books
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div>
          <p className="eyebrow">For readers</p>
          <h2>Where to start, and what&apos;s next.</h2>
        </div>
        <div className="prose">
          <p>
            New readers should start with <em>The Probationers</em>, a snowbound
            monastery mystery built around a murder beneath a bell tower. Another
            mystery is slowly finding its way to the page.
          </p>
          <p>
            For essays, craft notes, and launch updates, read the{" "}
            <Link className="textLink" href="/blog">
              blog
            </Link>{" "}
            or{" "}
            <Link className="textLink" href="/#subscribe">
              join the reader list
            </Link>
            .
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
