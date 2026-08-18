import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ReadingProgress } from "@/components/ReadingProgress";
import { ArcProgressBeacon } from "@/components/ArcProgressBeacon";
import { ArcReaderShield } from "@/components/ArcReaderShield";
import { requireActiveReader } from "@/lib/arc-auth";
import {
  checkAndStampReadThrottle,
  getArcBook,
  getArcProgress,
  getChapterByOrder,
  getChapterSummaries,
} from "@/lib/arc";
import {
  readerFingerprint,
  visibleWatermarkTile,
  watermarkHtml,
} from "@/lib/watermark";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ chapter?: string }>;
};

export const metadata: Metadata = {
  title: "Reading",
  robots: { index: false, follow: false },
};

/**
 * The in-browser ARC reader. The manuscript is unpublished work, so this page:
 *   - requires a live, non-revoked reader session AND an explicit assignment,
 *   - renders chapter HTML server-side (nothing is exposed as a fetchable file),
 *   - is noindex here and disallowed in robots.ts, with no-store headers set in
 *     next.config.mjs.
 */
export default async function ArcReadPage({ params, searchParams }: Props) {
  const reader = await requireActiveReader();

  if (!reader) redirect("/arc/signin");

  const { slug } = await params;

  // An unassigned (or non-existent) book is indistinguishable from the reader's
  // point of view — both are simply not there.
  if (!reader.bookSlugs.includes(slug)) notFound();

  const book = await getArcBook(slug);

  if (!book) notFound();

  const chapters = await getChapterSummaries(slug);

  if (chapters.length === 0) notFound();

  const { chapter: chapterParam } = await searchParams;
  const requested = Number(chapterParam);
  const validRequest =
    Number.isFinite(requested) &&
    requested >= 1 &&
    chapters.some((c) => c.order === Math.floor(requested));

  let order: number;

  if (validRequest) {
    order = Math.floor(requested);
  } else {
    // No (or bogus) ?chapter — resume where they left off, else start at the
    // first chapter in the running order.
    const progress = await getArcProgress(reader.email, slug);
    const resume = progress?.chapterOrder;
    order =
      resume && chapters.some((c) => c.order === resume)
        ? resume
        : chapters[0].order;
  }

  const chapter = await getChapterByOrder(slug, order);

  if (!chapter) notFound();

  // Scrape brake. Soft by design: pauses reading briefly, never revokes.
  if ((await checkAndStampReadThrottle(reader.email, slug, order)) === "limited") {
    return <SlowDown bookTitle={book.title} />;
  }

  // Leak fingerprint, applied per-request so it never reaches storage or the
  // admin editor. Falls through untouched when no secret is configured.
  const fingerprint = readerFingerprint(reader.email);
  const bodyHtml = fingerprint
    ? watermarkHtml(chapter.html, fingerprint)
    : chapter.html;

  // Unlike the invisible fingerprint this needs no secret — it *is* the
  // address — so it applies even when ARC_WATERMARK_SECRET is unset.
  const shield = visibleWatermarkTile(reader.email);

  const index = chapters.findIndex((c) => c.order === order);
  const prev = index > 0 ? chapters[index - 1] : null;
  const next = index < chapters.length - 1 ? chapters[index + 1] : null;
  const isLast = !next;

  return (
    <main>
      <ReadingProgress />
      <ArcProgressBeacon bookSlug={slug} chapterOrder={order} />
      {/* Scoped to this page on purpose — it's the only surface holding
          manuscript text, and the shortcuts it swallows would be a pointless
          annoyance on the library and review pages. */}
      <ArcReaderShield />

      <div className="arcReaderBar">
        <Link className="arcReaderBack" href="/arc/library">
          ← Library
        </Link>
        <span className="arcReaderBookTitle">{book.title}</span>
        <span className="arcReaderWatermark">{reader.email}</span>
        <span className="arcReaderCount">
          {index + 1} / {chapters.length}
        </span>
      </div>

      <article className="articlePage arcReaderPage">
        <p className="eyebrow">Chapter {chapter.order}</p>
        <h1>{chapter.title}</h1>

        <details className="arcChapterNav">
          <summary>All chapters</summary>
          <ol className="arcChapterList">
            {chapters.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/arc/read/${slug}?chapter=${item.order}`}
                  className={item.order === order ? "isCurrent" : undefined}
                  aria-current={item.order === order ? "page" : undefined}
                >
                  <span className="arcChapterNumber">{item.order}</span>
                  {item.title}
                </Link>
              </li>
            ))}
          </ol>
        </details>

        {/*
          Author-authored HTML, sanitised on save (lib/sanitize.ts) and
          fingerprinted per reader on the way out (lib/watermark.ts).

          The overlay sibling carries the *visible* half of that fingerprint.
          It's painted over the prose rather than behind it so that a screenshot
          or a photo of the screen — both of which destroy the zero-width marks
          woven into `bodyHtml` — still carries the reader's address.
        */}
        <div className="arcBodyGuard">
          {shield && (
            <div
              aria-hidden="true"
              className="arcBodyShield"
              style={{ backgroundImage: `url("${shield}")` }}
            />
          )}
          <div
            className="articleBody"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>

        <p className="arcWatermarkLine">
          Advance copy prepared for {reader.name || reader.email} ·{" "}
          {reader.email}. Please don&apos;t share or forward it.
        </p>

        <nav className="arcChapterPager" aria-label="Chapter navigation">
          {prev ? (
            <Link
              className="button secondary"
              href={`/arc/read/${slug}?chapter=${prev.order}`}
            >
              ← Chapter {prev.order}
            </Link>
          ) : (
            <span />
          )}

          {next ? (
            <Link
              className="button primary"
              href={`/arc/read/${slug}?chapter=${next.order}`}
            >
              Chapter {next.order} →
            </Link>
          ) : (
            <Link className="button primary" href={`/arc/review/${slug}`}>
              Write your review →
            </Link>
          )}
        </nav>

        {isLast && (
          <div className="arcReaderEnd">
            <p className="eyebrow">The end</p>
            <h2>Thank you for reading.</h2>
            <p>
              That&apos;s the whole book. If you&apos;d like to leave an honest
              review, it&apos;s the single most helpful thing — it&apos;s what
              helps other readers find the story.
            </p>
            <Link className="button primary" href={`/arc/review/${slug}`}>
              Write your review
            </Link>
          </div>
        )}
      </article>
    </main>
  );
}

/**
 * Shown instead of a chapter when the read throttle trips. Nothing about the
 * reader's standing has changed, so the copy stays warm and says so.
 */
function SlowDown({ bookTitle }: { bookTitle: string }) {
  return (
    <main>
      <div className="arcReaderBar">
        <Link className="arcReaderBack" href="/arc/library">
          ← Library
        </Link>
        <span className="arcReaderBookTitle">{bookTitle}</span>
      </div>

      <article className="articlePage arcReaderPage">
        <div className="arcReaderEnd">
          <p className="eyebrow">One moment</p>
          <h2>You&apos;re turning pages quickly.</h2>
          <p>
            To protect an unpublished manuscript, reading pauses briefly when a
            lot of chapters are opened in a short burst. Nothing has changed
            about your access and your place is saved — this chapter will open
            again in a few minutes.
          </p>
          <Link className="button primary" href="/arc/library">
            Back to my library
          </Link>
        </div>
      </article>
    </main>
  );
}
