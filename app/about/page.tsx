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
    siteName: "Aftab Arbiyani",
    locale: "en_US",
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
    "Aftab Arbiyani is a psychological mystery writer and software engineer based in India, and the author of the debut novel The Probationers, a snowbound abbey murder mystery about faith, exile, and secrecy.",
  sameAs: [
    "https://www.amazon.com/dp/B0GX33TZC3",
    "https://www.goodreads.com/author/show/70322137.Aftab_Arbiyani",
  ],
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
            By day, Aftab Arbiyani builds software. He is a technical lead based
            in India, with more than five years spent designing and building
            large-scale backend systems, and he leads engineering work at
            SolGuruz. He studied Computer Engineering at Government Engineering
            College, Bhavnagar.
          </p>
          <p>
            By night, he writes the kind of puzzle that can&apos;t be solved with
            code. <em>The Probationers</em> is his debut novel, and a second
            mystery is already finding its way to the page.
          </p>
        </div>
      </section>

      <section className="section">
        <div>
          <p className="eyebrow">Why mysteries</p>
          <h2>The same instincts, a different kind of system.</h2>
        </div>
        <div className="prose">
          <p>
            A good mystery and a good piece of software are built from the same
            materials: a closed system, a hidden logic, and the way a single
            constraint changes everything downstream. Years of tracing how
            sealed systems behave under pressure, and where their quiet failure
            points hide, turn out to be unlikely but useful training for a
            locked-room murder.
          </p>
          <p>
            It is why his fiction keeps returning to closed, self-contained
            worlds, and to the private bargains people make to stay inside them.
            He writes for readers who believe a mystery should earn its ending:
            every clue on the page, and a solution that feels inevitable only
            once you have seen it.
          </p>
        </div>
      </section>

      <section className="section">
        <div>
          <p className="eyebrow">The book</p>
          <h2>The Probationers</h2>
        </div>
        <div className="prose">
          <p>
            His debut is a murder mystery set inside a snowbound Benedictine
            monastery in the Umbrian hills: six novices, one body, and
            sixty-four years of buried secrets. When the novice master is found
            dead beneath the bell tower, Sister Aude Bellamy must separate
            accident from intention before the snow clears.
          </p>
          <div className="actions">
            <BuyOnAmazon
              asin="B0GX33TZC3"
              initialCode={storeCode}
              variant="primary"
              showSwitcher={false}
              label="Read The Probationers"
            />
            <Link className="button secondary" href="/books/the-probationers">
              Full synopsis &amp; details
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
            New readers should start with{" "}
            <Link className="textLink" href="/books/the-probationers">
              <em>The Probationers</em>
            </Link>
            , a snowbound monastery mystery built around a murder beneath a bell
            tower. Another mystery is slowly finding its way to the page.
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
