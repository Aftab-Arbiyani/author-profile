import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { BrandMark } from "@/components/BrandMark";
import { detectStoreCode } from "@/lib/detect-store";
import { storeUrl, AMAZON_LINK_REL } from "@/lib/amazon";
import { jsonLdScript } from "@/lib/jsonld";

const ASIN = "B0GX33TZC3";
const PRESS_EMAIL = "aftabarbiyani@gmail.com";

export const metadata: Metadata = {
  title: "Press & Media Kit",
  description:
    "Press & media kit for novelist Aftab Arbiyani: ready-to-use bios, a book fact sheet, synopsis, cover art, and interview questions for The Probationers.",
  alternates: {
    canonical: "/press",
  },
  openGraph: {
    siteName: "Aftab Arbiyani",
    locale: "en_US",
    title: "Press & Media Kit | Aftab Arbiyani",
    description:
      "Author bios, book fact sheet, synopsis, cover art, interview questions, and press contact for Aftab Arbiyani and The Probationers.",
    url: "/press",
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
    title: "Press & Media Kit | Aftab Arbiyani",
    description:
      "Author bios, book fact sheet, synopsis, cover art, interview questions, and press contact for Aftab Arbiyani and The Probationers.",
    images: ["/og-default.jpg"],
  },
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
      name: "Press & Media Kit",
      item: "https://www.aftabarbiyani.com/press",
    },
  ],
};

const facts: { label: string; value: React.ReactNode }[] = [
  { label: "Title", value: "The Probationers" },
  { label: "Author", value: "Aftab Arbiyani" },
  { label: "Genre", value: "Psychological murder mystery / closed-circle whodunit" },
  { label: "Formats", value: "Kindle ebook and paperback (361 pages)" },
  { label: "Paperback ISBN", value: "9798197795472" },
  { label: "Kindle ASIN", value: "B0GX33TZC3" },
  { label: "Publication date", value: "May 15, 2026" },
  { label: "Publisher", value: "Independently published" },
  { label: "Language", value: "English" },
];

const interviewQuestions = [
  "You're a software engineer by profession. How did that lead you to writing a locked-room murder mystery?",
  "Why set the novel inside a snowbound Benedictine monastery? What drew you to that closed world?",
  "The Probationers is a “closed-circle” mystery. What makes that structure satisfying to write, and to read?",
  "Your investigator is a canon lawyer rather than a detective. Why that choice?",
  "The book is about belonging and exile. What does that theme mean to you?",
  "What do you mean when you say a mystery should “earn its ending”?",
  "Which mystery writers shaped how you approach the genre?",
  "What can you tell us about the second novel?",
];

export default async function PressPage() {
  const storeCode = await detectStoreCode();
  const buyHref = storeUrl(storeCode, ASIN);

  return (
    <main>
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
            <Link href="/about">About</Link>
            <Link href="/#books">Books</Link>
            <Link href="/blog">Blog</Link>
          </div>
        </nav>
        <div className="simpleHeroCopy">
          <p className="eyebrow">Press</p>
          <h1>Press &amp; Media Kit</h1>
          <p className="lede">
            Everything you need to feature Aftab Arbiyani and his debut mystery
            The Probationers: ready-to-use bios, a book fact sheet, the synopsis,
            cover art, and suggested interview questions. For anything else,{" "}
            <a className="textLink" href={`mailto:${PRESS_EMAIL}`}>
              get in touch
            </a>
            .
          </p>
        </div>
      </section>

      {/* Press contact */}
      <section className="section">
        <div>
          <p className="eyebrow">Press contact</p>
          <h2>Interviews &amp; review copies.</h2>
        </div>
        <div className="prose">
          <p>
            For interviews, review copies, event and book-club requests, or
            high-resolution assets, contact Aftab Arbiyani directly:
          </p>
          <p className="contactLine">
            <strong>Email:</strong>{" "}
            <a href={`mailto:${PRESS_EMAIL}`}>{PRESS_EMAIL}</a>
          </p>
        </div>
      </section>

      {/* Bios */}
      <section className="section split">
        <div>
          <p className="eyebrow">Author bio</p>
          <h2>Bios, ready to paste.</h2>
        </div>
        <div className="prose">
          <p className="eyebrow">One line</p>
          <p>
            Aftab Arbiyani is a software engineer and debut novelist whose
            psychological mystery The Probationers is a locked-room murder set in
            a snowbound Italian monastery.
          </p>

          <p className="eyebrow">Short (approx. 50 words)</p>
          <p>
            Aftab Arbiyani is a psychological mystery writer and software
            engineer based in India. His debut novel, The Probationers, is a
            closed-circle murder mystery set inside a snowbound Benedictine
            monastery in the Umbrian hills. He writes locked-room fiction for
            readers who believe a mystery should earn its ending. A second novel
            is underway.
          </p>

          <p className="eyebrow">Long (approx. 150 words)</p>
          <p>
            Aftab Arbiyani is a software engineer, technical lead, and debut
            novelist based in India. By day he designs and builds large-scale
            backend systems. He has done this for more than five years and now
            leads engineering at SolGuruz; he studied Computer Engineering at
            Government
            Engineering College, Bhavnagar. By night he writes psychological
            mystery fiction.
          </p>
          <p>
            His debut novel, The Probationers, is a closed-circle murder mystery
            set across seven snowbound days in a Benedictine monastery in the
            Umbrian hills, where a priest is found dead at the foot of the bell
            tower and a canon lawyer is sent to find the truth before the civil
            authorities arrive. The book grew out of a long fascination with
            closed systems and hidden logic, the same instincts that shape
            good software, turned on a locked-room mystery. He writes for readers
            who believe a mystery should earn its ending, and a second novel is
            on the way.
          </p>
        </div>
      </section>

      {/* Book fact sheet */}
      <section className="section split">
        <div>
          <p className="eyebrow">The book</p>
          <h2>Fact sheet.</h2>
        </div>
        <div className="prose">
          <dl className="factSheet">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
            <div>
              <dt>Buy</dt>
              <dd>
                <a href={buyHref} target="_blank" rel={AMAZON_LINK_REL}>
                  Amazon
                </a>{" "}
                &middot;{" "}
                <Link className="textLink" href="/books/the-probationers">
                  Book page
                </Link>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Synopsis */}
      <section className="section split">
        <div>
          <p className="eyebrow">Synopsis</p>
          <h2>Short &amp; long.</h2>
        </div>
        <div className="prose">
          <p className="eyebrow">Logline</p>
          <p>
            The Probationers is a closed-circle mystery set across seven snowbound
            days in a Benedictine enclosure in the Umbrian hills. A priest is
            found dead at the base of the bell tower. A canon lawyer is sent from
            Rome to find out what happened before the civil authorities arrive.
            She has seven days, and six novices.
          </p>

          <p className="eyebrow">Full synopsis</p>
          <p>
            At the Abbazia di San Gerolamo, a Benedictine monastery high in the
            Umbrian hills, six postulants are halfway through the year that will
            decide the rest of their lives. On the morning of the mid-winter
            feast, the novice master, Father Tomaso Ricci, is found at the foot
            of the bell tower. It looks like a fall. It isn&apos;t. And by
            nightfall the snow has closed every road off the mountain.
          </p>
          <p>
            Sister Aude Bellamy, a Dominican canon lawyer and former French
            magistrate, is sent to establish what happened before the civil
            authorities can reach the abbey. What she finds is a community bound
            by the Great Silence, where each postulant is guarding a secret they
            would do almost anything to keep, and where the line between
            confession and survival has quietly disappeared.
          </p>
          <p>
            The Probationers is a locked-room mystery about belonging and exile,
            about what a person will do to stay inside the world they have built
            for themselves. It is written for readers who believe a mystery
            should earn its ending.
          </p>
        </div>
      </section>

      {/* Cover & assets */}
      <section className="section split">
        <div>
          <p className="eyebrow">Assets</p>
          <h2>Cover &amp; photography.</h2>
        </div>
        <div className="prose">
          <div className="pressCover">
            <Image
              className="bookCoverImg"
              src="/the-probationers-cover.jpeg"
              alt="Cover of The Probationers by Aftab Arbiyani"
              fill
              sizes="(max-width: 400px) 90vw, 340px"
              quality={90}
            />
          </div>
          <p>
            <a
              className="textLink"
              href="/the-probationers-cover.jpeg"
              download
              target="_blank"
              rel="noopener noreferrer"
            >
              Download cover image (JPEG) &darr;
            </a>
          </p>
          <p>
            A high-resolution cover and an author photograph are available on
            request:{" "}
            <a className="textLink" href={`mailto:${PRESS_EMAIL}`}>
              email for assets
            </a>
            . Please credit the cover art to the author.
          </p>
        </div>
      </section>

      {/* Interview questions */}
      <section className="section split">
        <div>
          <p className="eyebrow">For interviewers</p>
          <h2>Suggested questions.</h2>
        </div>
        <div className="prose">
          <p>
            A starting point for interviews, podcasts, and features: use, adapt,
            or ignore as you like.
          </p>
          <ol className="pressQuestions">
            {interviewQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
