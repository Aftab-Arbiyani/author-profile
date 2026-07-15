import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getBlogPosts } from "@/lib/firestore";
import { BuyOnAmazon } from "@/components/BuyOnAmazon";
import { SamplePreview } from "@/components/SamplePreview";
import { SubscribeForm } from "@/components/SubscribeForm";
import { detectStoreCode } from "@/lib/detect-store";
import { SiteFooter } from "@/components/SiteFooter";
import { BrandMark } from "@/components/BrandMark";
import { jsonLdScript } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Aftab Arbiyani | Author of Psychological Mystery Fiction",
  description:
    "Aftab Arbiyani writes psychological mystery fiction. His debut novel The Probationers is a snowbound abbey murder mystery available on Amazon.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Aftab Arbiyani | Psychological Mystery Author",
    description:
      "Debut mystery novel The Probationers: six postulants, one snowbound abbey, a murder beneath the bell tower.",
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
    title: "Aftab Arbiyani | Psychological Mystery Author",
    description:
      "Debut mystery novel The Probationers: six postulants, one snowbound abbey, a murder beneath the bell tower.",
    images: ["/og-default.jpg"],
  },
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://www.aftabarbiyani.com/#person",
  name: "Aftab Arbiyani",
  url: "https://www.aftabarbiyani.com",
  description:
    "Aftab Arbiyani is a psychological mystery writer whose debut novel The Probationers is a snowbound abbey murder mystery about faith, exile, and secrecy.",
  sameAs: ["https://www.amazon.com/dp/B0GX33TZC3"],
  jobTitle: "Author",
  email: "aftabarbiyani@gmail.com",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.aftabarbiyani.com/#website",
  url: "https://www.aftabarbiyani.com",
  name: "Aftab Arbiyani",
  description:
    "Author profile, books, and essays for psychological mystery writer Aftab Arbiyani.",
  publisher: { "@id": "https://www.aftabarbiyani.com/#person" },
};

const bookJsonLd = {
  "@context": "https://schema.org",
  "@type": "Book",
  "@id": "https://www.aftabarbiyani.com/#book-the-probationers",
  name: "The Probationers",
  url: "https://www.amazon.com/dp/B0GX33TZC3",
  author: { "@id": "https://www.aftabarbiyani.com/#person" },
  isbn: "9798197795472",
  bookFormat: "https://schema.org/Paperback",
  genre: "Psychological Mystery",
  description:
    "Six postulants. One snowbound abbey. A novice master found dead beneath the bell tower, and a truth hidden inside a lifetime of devotion.",
  offers: {
    "@type": "Offer",
    url: "https://www.amazon.com/dp/B0GX33TZC3",
    availability: "https://schema.org/InStock",
  },
};

const questions = [
  {
    question: "What does Aftab write?",
    answer:
      "Psychological mystery fiction about faith, exile, secrecy, and the private bargains people make to remain inside the worlds they love.",
  },
  {
    question: "Where should new readers begin?",
    answer:
      "Start with The Probationers, a snowbound monastery mystery built around a murder beneath a bell tower.",
  },
  {
    question: "Will there be more books?",
    answer:
      "Yes. This profile is designed to grow into a wider author catalogue as future books are released.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: questions.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const details = [
  "Mystery Fiction",
  "Psychological Suspense",
  "Literary Whodunits",
  "Moral Secrets",
];

const books = [
  {
    title: "The Probationers",
    status: "Available now",
    genre: "Murder Mystery / Whodunit",
    description:
      "Six postulants. One snowbound abbey. A novice master found dead beneath the bell tower, and a truth hidden inside a lifetime of devotion.",
    asin: "B0GX33TZC3",
    sampleUrl: "https://read.amazon.com/sample/B0GX33TZC3?clientId=share",
  },
];

export default async function Home() {
  const posts = await getBlogPosts(3);
  const storeCode = await detectStoreCode();

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(bookJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd) }}
      />
      <section className="hero" id="home">
        <nav className="nav" aria-label="Primary">
          <a className="brand" href="#home" aria-label="Aftab Arbiyani home">
            <BrandMark size={26} className="brandMark" />
            Aftab Arbiyani
          </a>
          <div className="navLinks">
            <Link href="/about">About</Link>
            <a href="#books">Books</a>
            <Link href="/blog">Blog</Link>
            <a href="#questions">Q&A</a>
          </div>
        </nav>

        <div className="heroGrid">
          <div className="heroCopy">
            <p className="eyebrow">Author of psychological mystery fiction</p>
            <h1>Aftab Arbiyani</h1>
            <p className="lede">
              Stories of belonging, exile, faith, and silence, where the crime
              is only the first door into what people are desperate to protect.
            </p>
            <div className="actions">
              <BuyOnAmazon
                asin="B0GX33TZC3"
                initialCode={storeCode}
                variant="primary"
                showSwitcher={false}
                label="Latest book"
              />
              <a className="button secondary" href="#books">
                View books
              </a>
            </div>
          </div>

          <div className="coverStage">
            <Image
              className="coverImage"
              src="/the-probationers-cover.jpeg"
              alt="The Probationers, debut psychological mystery novel by Aftab Arbiyani"
              fill
              sizes="(max-width: 820px) 310px, 390px"
              priority
            />
          </div>
        </div>
      </section>

      <section className="section intro" id="author">
        <div>
          <p className="eyebrow">Author profile</p>
          <h2>Mysteries about the selves people cannot afford to lose.</h2>
        </div>
        <div className="prose">
          <p>
            Aftab Arbiyani is a software engineer and technical lead based in
            India, who spends his days architecting systems and his nights
            building the kind of puzzles that can&apos;t be solved with code.
          </p>
          <p>
            The Probationers is his debut novel, a murder mystery set inside a
            snowbound Benedictine monastery in the Umbrian hills, where six
            novices, one body, and sixty-four years of buried secrets converge.
            The book draws on his long fascination with closed systems, hidden
            logic, and the question of what a person will do to stay inside the
            life they have built for themselves.
          </p>
          <p>He writes for readers who believe a mystery should earn its ending.</p>
          <p>Another mystery is slowly finding its way to the page.</p>
          <p className="contactLine">
            <strong>Contact:</strong>{" "}
            <a href="mailto:aftabarbiyani@gmail.com">aftabarbiyani@gmail.com</a>
          </p>
        </div>
      </section>

      <section className="detailBand">
        {details.map((item) => (
          <div className="detail" key={item}>
            {item}
          </div>
        ))}
      </section>

      <section className="booksSection" id="books">
        <div className="sectionHeader">
          <p className="eyebrow">Books</p>
          <h2>Published Work</h2>
        </div>
        <div className="bookShelf">
          {books.map((book) => (
            <article className="bookCard" key={book.title}>
              <div className="bookCover">
                <Image
                  className="bookCoverImg"
                  src="/the-probationers-cover.jpeg"
                  alt={`Cover of ${book.title} by Aftab Arbiyani`}
                  fill
                  sizes="(max-width: 820px) 260px, 260px"
                  quality={90}
                />
              </div>
              <div className="bookInfo">
                <span>{book.status}</span>
                <h3>{book.title}</h3>
                <p className="bookGenre">{book.genre}</p>
                <p>{book.description}</p>
                <div className="bookMeta">
                  <span>ASIN {book.asin}</span>
                  <BuyOnAmazon
                    asin={book.asin}
                    initialCode={storeCode}
                    variant="bare"
                    showSwitcher
                    label="Buy on Amazon"
                  />
                </div>
                <SamplePreview sampleUrl={book.sampleUrl} title={book.title} />
              </div>
            </article>
          ))}
          {/* Hidden until real upcoming titles are ready. Restore this card to
              show a "more books coming" placeholder in the catalogue. */}
          {/* <article className="futureCard">
            <span>Future titles</span>
            <h3>More books will appear here.</h3>
            <p>
              This catalogue is ready for upcoming novels, series pages, launch
              links, and reader updates.
            </p>
          </article> */}
        </div>
      </section>

      <section className="section split" id="book">
        <div>
          <p className="eyebrow">Featured book</p>
          <h2>Belonging can become a locked room.</h2>
        </div>
        <p>
          At the Abbazia di San Gerolamo, the Great Silence should protect the
          life of the community. Instead, it hides a murder. Sister Aude Bellamy
          arrives to separate accident from intention, obedience from fear, and
          confession from survival.
        </p>
      </section>

      <section className="blogPreview" id="blog">
        <div className="sectionHeader">
          <p className="eyebrow">Blog</p>
          <h2>Essays & Updates</h2>
        </div>
        {posts.length > 0 ? (
          <div className="postGrid">
            {posts.map((post) => (
              <article className="postCard" key={post.id}>
                <p className="postDate">
                  {post.publishedAt ? (
                    <time dateTime={post.publishedAt}>
                      {formatDate(post.publishedAt)}
                    </time>
                  ) : (
                    formatDate(post.publishedAt)
                  )}
                </p>
                <h3>
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>
                <p>{post.excerpt}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyState compact">
            <p className="eyebrow">Coming soon</p>
            <h3>New essays and book notes will appear here.</h3>
            <p>
              Follow along for launch updates, reading notes, and reflections
              from the writing desk.
            </p>
          </div>
        )}
        <Link className="textLink" href="/blog">
          Visit the blog
        </Link>
      </section>

      <section className="subscribeSection" id="subscribe">
        <div>
          <p className="eyebrow">Newsletter</p>
          <h2>Get new-book news, essays, and subscriber-only offers.</h2>
        </div>
        <SubscribeForm />
      </section>

      <section className="section questions" id="questions">
        <div className="sectionHeader">
          <p className="eyebrow">Q&A</p>
          <h2>Reader Questions</h2>
        </div>
        <div className="questionList">
          {questions.map((item) => (
            <details className="questionItem" key={item.question}>
              <summary>
                <span className="questionText">{item.question}</span>
                <span className="questionIcon" aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function formatDate(value: string) {
  if (!value) {
    return "Draft";
  }

  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
