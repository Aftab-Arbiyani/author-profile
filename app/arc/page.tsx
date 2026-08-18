import Link from "next/link";
import type { Metadata } from "next";
import { ArcApplyForm } from "@/components/ArcApplyForm";
import { SiteFooter } from "@/components/SiteFooter";
import { BrandMark } from "@/components/BrandMark";
import { jsonLdScript } from "@/lib/jsonld";

const ARC_URL = "https://www.aftabarbiyani.com/arc";

export const metadata: Metadata = {
  title: "ARC Reader Program",
  description:
    "Apply to become an advance reader for Aftab Arbiyani's next psychological mystery. Approved ARC readers read the manuscript in their browser before publication and are invited to share an honest review.",
  alternates: {
    canonical: "/arc",
  },
  openGraph: {
    siteName: "Aftab Arbiyani",
    locale: "en_US",
    title: "ARC Reader Program — Read Aftab Arbiyani's Next Mystery Early",
    description:
      "Advance reader copies for readers of psychological mystery fiction. Apply to read the next novel before publication and share an honest review if you'd like to.",
    url: "/arc",
    type: "website",
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Aftab Arbiyani ARC reader program",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ARC Reader Program — Read Aftab Arbiyani's Next Mystery Early",
    description:
      "Advance reader copies for readers of psychological mystery fiction. Apply to read the next novel before publication and share an honest review if you'd like to.",
    images: ["/og-default.jpg"],
  },
};

// The ARC landing page is the only crawlable surface of the program — the
// library and reader routes are noindex + robots-disallowed, and unreleased
// book titles are deliberately never listed here.
const webPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${ARC_URL}#webpage`,
  url: ARC_URL,
  name: "ARC Reader Program",
  description:
    "Apply to become an advance reader for Aftab Arbiyani's next psychological mystery. Approved readers read the manuscript before publication and are invited to share an honest review.",
  isPartOf: { "@id": "https://www.aftabarbiyani.com/#website" },
  about: { "@id": "https://www.aftabarbiyani.com/#book-the-probationers" },
  author: { "@id": "https://www.aftabarbiyani.com/#person" },
  inLanguage: "en",
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
      name: "ARC Reader Program",
      item: ARC_URL,
    },
  ],
};

const steps = [
  {
    title: "Apply",
    body: "Fill in the short form below. Tell me what you read, where you review, and why this book appeals to you. Every application is read personally.",
  },
  {
    title: "Get approved",
    body: "If you're a fit, you'll get an email confirming your place on the ARC team and a sign-in link for your private reading library.",
  },
  {
    title: "Read early",
    body: "The manuscript opens in your browser, chapter by chapter, with your place saved as you go. Nothing to download, nothing to install.",
  },
  {
    title: "Leave an honest review",
    body: "When you finish, write your review from your library. Approved reviews appear on the book's page, and you're free to post them on Amazon and Goodreads at launch.",
  },
];

const questions = [
  {
    question: "What is an ARC reader?",
    answer:
      "An ARC reader receives an Advance Reader Copy — the finished manuscript of a book before it is published. ARC readers are asked to read it within a few weeks, and I hope they'll consider leaving an honest review — it's what helps other readers decide.",
  },
  {
    question: "Does it cost anything to be an ARC reader?",
    answer:
      "No. Advance reader copies are free, and there is no obligation. Once you have finished reading, I hope you'll consider leaving an honest review — whether or not you loved the book.",
  },
  {
    question: "How do I read the book once I'm approved?",
    answer:
      "You read it in your browser. After signing in with a one-time email link, the manuscript appears in your private library and you can read it chapter by chapter on a phone, tablet, or computer. There is no file to download.",
  },
  {
    question: "Do I have to leave a positive review?",
    answer:
      "No. An honest review is the whole point. A thoughtful three-star review is more useful to readers, and to me as a writer, than a five-star review nobody believes.",
  },
  {
    question: "How long do I have to read the book?",
    answer:
      "Usually three to four weeks before publication day. If you need longer, just reply to the approval email and say so — a late review is far better than a rushed one.",
  },
  {
    question: "Who is accepted as an ARC reader?",
    answer:
      "Readers who genuinely enjoy psychological mystery and crime fiction, and who review where other readers will see it: Amazon, Goodreads, a blog, BookTok, or Bookstagram. A large following is not required.",
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

export default function ArcPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd) }}
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
          <p className="eyebrow">ARC readers</p>
          <h1>Read it before anyone else.</h1>
          <p className="lede">
            A small group of readers gets each new mystery before publication —
            and is invited to share an honest review. Applications are open.
          </p>
          <div className="actions">
            <a className="button primary" href="#apply">
              Apply to read early
            </a>
            <Link className="button secondary" href="/arc/signin">
              Already a reader? Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="section split">
        <div>
          <p className="eyebrow">The idea</p>
          <h2>What is an ARC reader?</h2>
        </div>
        <div className="prose">
          <p>
            An ARC reader receives an <strong>Advance Reader Copy</strong> — the
            finished manuscript of a book before it reaches the shops. Publishers
            have done this for decades, because the readers who arrive first are
            the ones who tell everyone else whether a book is worth their evening.
          </p>
          <p>
            For a mystery, that matters even more. A whodunit lives or dies on
            whether the ending feels earned, and the only people who can tell me
            that are readers who have never seen the book before.
          </p>
          <p>
            If you read psychological mystery and crime fiction and you review
            where other readers can see it, I&apos;d like you on the team. In the
            meantime,{" "}
            <Link className="textLink" href="/books/the-probationers">
              The Probationers is out now
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="section split">
        <div>
          <p className="eyebrow">How it works</p>
          <h2>Four steps, start to review.</h2>
        </div>
        <div className="prose">
          <ol className="arcSteps">
            {steps.map((step, index) => (
              <li className="arcStep" key={step.title}>
                <span className="arcStepNumber" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <p className="arcStepTitle">{step.title}</p>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section split">
        <div>
          <p className="eyebrow">What I hope for</p>
          <h2>An honest review, nothing more.</h2>
        </div>
        <div className="prose">
          <p>
            Read the book within the reading window — usually three to four weeks
            — and, if you&apos;re willing, post an honest review. Not a kind one:
            an honest one. If the middle sags or the killer was obvious by chapter
            nine, that is exactly what I need to hear, and exactly what other
            readers deserve to read. A review is never a condition of getting the
            book, and I&apos;d rather have your real opinion than a generous one.
          </p>
          <p>
            One genuine request: the manuscript is unpublished work, so please
            keep it to yourself. Don&apos;t share your sign-in link, quote long
            passages publicly, or post the text anywhere. Reviews, reactions, and
            spoiler-free enthusiasm are always welcome.
          </p>
        </div>
      </section>

      <section className="subscribeSection" id="apply">
        <div>
          <p className="eyebrow">Apply</p>
          <h2>Join the ARC team.</h2>
          <p className="arcApplyNote">
            Already approved?{" "}
            <Link className="textLink" href="/arc/signin">
              Sign in to your library →
            </Link>
          </p>
        </div>
        <ArcApplyForm />
      </section>

      <section className="section questions" id="questions">
        <div className="sectionHeader">
          <p className="eyebrow">Q&amp;A</p>
          <h2>ARC Reader Questions</h2>
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
