import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { BrandMark } from "@/components/BrandMark";
import {
  getSessionReader,
  isAccessExpired,
  logoutArcReader,
  requireActiveReader,
} from "@/lib/arc-auth";
import { getArcBook, getArcProgress, getArcReview } from "@/lib/arc";

export const metadata: Metadata = {
  title: "My ARC Library",
  robots: { index: false, follow: false },
};

const REVIEW_LABEL: Record<string, string> = {
  pending: "Review submitted · awaiting approval",
  approved: "Review published — thank you",
  rejected: "Review needs another look",
};

export default async function ArcLibraryPage() {
  const reader = await requireActiveReader();

  if (!reader) {
    // A lapsed reader still holds a valid session and can still redeem fresh
    // magic links, so bouncing them to sign-in would loop them straight back
    // here. Explain it instead. Revoked readers are deliberately not told
    // apart from unknown ones.
    const sessionReader = await getSessionReader();

    if (
      sessionReader &&
      sessionReader.status === "active" &&
      isAccessExpired(sessionReader)
    ) {
      const books = (
        await Promise.all(sessionReader.bookSlugs.map((slug) => getArcBook(slug)))
      ).filter((book): book is NonNullable<typeof book> => book !== null);

      return <AccessEndedPage name={sessionReader.name} books={books} />;
    }

    redirect("/arc/signin");
  }

  // Resolve each assigned book alongside this reader's progress and review
  // state. Assignments are a handful of slugs, so parallel reads are fine.
  const entries = (
    await Promise.all(
      reader.bookSlugs.map(async (slug) => {
        const [book, progress, review] = await Promise.all([
          getArcBook(slug),
          getArcProgress(reader.email, slug),
          getArcReview(slug, reader.email),
        ]);
        return book ? { book, progress, review } : null;
      }),
    )
  ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return (
    <main>
      <form
        id="arcSignoutForm"
        action={signOutAction}
        aria-hidden
        style={{ display: "none" }}
      />

      <section className="arcLibraryHeader">
        <nav className="arcAuthNav" aria-label="Primary">
          <Link className="arcAuthBrand" href="/">
            <BrandMark size={26} />
            Aftab Arbiyani
          </Link>
          <button
            type="submit"
            form="arcSignoutForm"
            className="arcSignoutButton"
          >
            Sign out
          </button>
        </nav>
        <div className="arcLibraryIntro">
          <p className="eyebrow">ARC library</p>
          <h1 className="arcLibraryTitle">
            Welcome back{reader.name ? `, ${reader.name.split(" ")[0]}` : ""}.
          </h1>
          <p className="arcLibraryLede">
            {entries.length === 0
              ? "Nothing to read just yet — you'll get an email the moment a manuscript is assigned to you."
              : "Your advance copies are below. Read in your browser; your place is saved as you go."}
          </p>
        </div>
      </section>

      <section className="arcLibrarySection">
        {entries.length === 0 ? (
          <p className="arcLibraryEmpty">
            In the meantime,{" "}
            <Link className="textLink" href="/books/the-probationers">
              The Probationers is out now
            </Link>
            .
          </p>
        ) : (
          <div className="arcLibraryGrid">
            {entries.map(({ book, progress, review }) => (
              <article className="arcLibraryCard" key={book.slug}>
                {book.coverUrl && (
                  <div className="arcLibraryCover">
                    <Image
                      src={book.coverUrl}
                      alt={`Cover of ${book.title}`}
                      fill
                      sizes="(max-width: 820px) 100vw, 200px"
                      className="arcLibraryCoverImg"
                    />
                  </div>
                )}
                <div className="arcLibraryInfo">
                  <h2 className="arcLibraryBookTitle">{book.title}</h2>
                  <p className="arcLibraryMeta">
                    {book.chapterCount}{" "}
                    {book.chapterCount === 1 ? "chapter" : "chapters"}
                    {progress ? ` · last read chapter ${progress.chapterOrder}` : ""}
                  </p>
                  {book.description && (
                    <p className="arcLibraryDesc">{book.description}</p>
                  )}

                  {review && (
                    <p
                      className={`arcStatusBadge arcStatus${cap(review.status)}`}
                    >
                      {REVIEW_LABEL[review.status] ?? review.status}
                    </p>
                  )}

                  <div className="arcLibraryActions">
                    {book.chapterCount > 0 ? (
                      <Link
                        className="button primary"
                        href={
                          progress
                            ? `/arc/read/${book.slug}?chapter=${progress.chapterOrder}`
                            : `/arc/read/${book.slug}`
                        }
                      >
                        {progress ? "Continue reading" : "Start reading"}
                      </Link>
                    ) : (
                      <span className="arcLibraryMeta">
                        Chapters are being prepared.
                      </span>
                    )}
                    <Link
                      className="button secondary"
                      href={`/arc/review/${book.slug}`}
                    >
                      {review && review.status !== "rejected"
                        ? "View my review"
                        : "Write a review"}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}

/**
 * Shown in place of the library when a reader's window has closed. Reviewing
 * stays open — expiry closes off the manuscript, not the review — so the books
 * they were reading are still linked here.
 */
function AccessEndedPage({
  name,
  books,
}: {
  name: string;
  books: { slug: string; title: string }[];
}) {
  return (
    <main>
      <form
        id="arcSignoutForm"
        action={signOutAction}
        aria-hidden
        style={{ display: "none" }}
      />

      <section className="arcLibraryHeader">
        <nav className="arcAuthNav" aria-label="Primary">
          <Link className="arcAuthBrand" href="/">
            <BrandMark size={26} />
            Aftab Arbiyani
          </Link>
          <button
            type="submit"
            form="arcSignoutForm"
            className="arcSignoutButton"
          >
            Sign out
          </button>
        </nav>
        <div className="arcLibraryIntro">
          <p className="eyebrow">ARC library</p>
          <h1 className="arcLibraryTitle">
            Your reading window has ended
            {name ? `, ${name.split(" ")[0]}` : ""}.
          </h1>
          <p className="arcLibraryLede">
            Advance copies stay open for a limited time while a book is still
            unpublished. Yours has now closed, so the manuscript is no longer
            available here.
            {books.length > 0 && " Your review is still open, though."}
          </p>
        </div>
      </section>

      <section className="arcLibrarySection">
        {books.length > 0 && (
          <div className="arcLibraryActions">
            {books.map((book) => (
              <Link
                className="button primary"
                href={`/arc/review/${book.slug}`}
                key={book.slug}
              >
                Review {book.title}
              </Link>
            ))}
          </div>
        )}

        <p className="arcLibraryEmpty">
          If you were partway through and would like more time, just reply to
          your approval email and I&apos;ll reopen it. In the meantime,{" "}
          <Link className="textLink" href="/books/the-probationers">
            The Probationers is out now
          </Link>
          .
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}

async function signOutAction() {
  "use server";
  await logoutArcReader();
  redirect("/arc/signin");
}

function cap(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
