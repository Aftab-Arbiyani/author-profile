import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { BrandMark } from "@/components/BrandMark";
import { requireReviewingReader } from "@/lib/arc-auth";
import { getArcBook, getArcReview, submitArcReview } from "@/lib/arc";
import { BEST_RATING, starString } from "@/lib/reviews";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
};

export const metadata: Metadata = {
  title: "Write Your ARC Review",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  "missing-fields": "Please add a rating, a headline, and a few sentences.",
  locked:
    "This review has already been published, so it can no longer be edited.",
  "not-configured": "Reviews aren't available right now. Please try again later.",
  failed: "Something went wrong saving your review. Please try again.",
};

const STATUS_COPY: Record<string, string> = {
  pending:
    "Your review has been submitted and is waiting for the author to publish it. You can still edit it below.",
  approved:
    "Your review is published on the book's page — thank you. It's now locked from editing.",
  rejected:
    "The author asked for another look at this review. Edit and resubmit it below.",
};

export default async function ArcReviewPage({ params, searchParams }: Props) {
  const reader = await requireReviewingReader();

  if (!reader) redirect("/arc/signin");

  const { slug } = await params;

  if (!reader.bookSlugs.includes(slug)) notFound();

  const [book, review] = await Promise.all([
    getArcBook(slug),
    getArcReview(slug, reader.email),
  ]);

  if (!book) notFound();

  const { status } = await searchParams;
  const error = status ? ERRORS[status] : undefined;
  const saved = status === "saved";
  const locked = review?.status === "approved";

  return (
    <main>
      <div className="arcReaderBar">
        <Link className="arcReaderBack" href="/arc/library">
          ← Library
        </Link>
        <span className="arcReaderBookTitle">{book.title}</span>
        <Link className="arcReaderBack" href={`/arc/read/${slug}`}>
          Read →
        </Link>
      </div>

      <section className="arcAuthPage">
        <nav className="arcAuthNav" aria-label="Primary">
          <Link className="arcAuthBrand" href="/">
            <BrandMark size={26} />
            Aftab Arbiyani
          </Link>
        </nav>

        <div className="arcAuthCard arcReviewCard">
          <p className="eyebrow">Your review</p>
          <h1 className="arcAuthTitle">{book.title}</h1>

          {error && <p className="subscribeMsg isError">{error}</p>}
          {saved && (
            <p className="subscribeMsg isOk">
              Thank you — your review has been submitted for publishing.
            </p>
          )}
          {review && !error && !saved && (
            <p
              className={`subscribeMsg ${
                review.status === "rejected" ? "isError" : "isOk"
              }`}
            >
              {STATUS_COPY[review.status]}
            </p>
          )}

          {locked ? (
            <div className="arcReviewLocked">
              <p className="arcReviewStars" aria-hidden="true">
                {starString(review.rating)}
              </p>
              <p className="arcReviewLockedTitle">{review.title}</p>
              {/* Reader-authored text — plain text node, never HTML. */}
              <p className="arcReviewLockedBody">{review.body}</p>
              <p className="arcAuthFoot">
                Posting it on Amazon or Goodreads too is the single most useful
                thing you can do for the book. When you do, please mention that
                you received a free advance copy — reviewers are expected to
                disclose that, and it costs the review nothing.
              </p>
            </div>
          ) : (
            <form
              action={submitReviewAction.bind(null, slug)}
              className="subscribeForm arcApplyForm"
            >
              <fieldset className="arcRatingField">
                <legend>Your rating</legend>
                <div className="arcRatingOptions">
                  {[5, 4, 3, 2, 1].map((value) => (
                    <label className="arcRatingOption" key={value}>
                      <input
                        type="radio"
                        name="rating"
                        value={value}
                        defaultChecked={review?.rating === value}
                        required
                      />
                      <span className="arcRatingStars" aria-hidden="true">
                        {starString(value)}
                      </span>
                      <span className="arcRatingLabel">
                        {value} out of {BEST_RATING}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label htmlFor="arc-review-title">Headline</label>
              <input
                id="arc-review-title"
                name="title"
                type="text"
                placeholder="Sum up your review in a line"
                defaultValue={review?.title ?? ""}
                required
                maxLength={120}
              />

              <label htmlFor="arc-review-body">Your review</label>
              <textarea
                id="arc-review-body"
                name="body"
                rows={9}
                placeholder="What worked, what didn't, and who you'd recommend it to. Honest is more useful than kind."
                defaultValue={review?.body ?? ""}
                required
                minLength={40}
                maxLength={2000}
              />

              <button type="submit" className="arcApplyButton">
                {review ? "Resubmit review" : "Submit review"}
              </button>

              <p>
                Reviews are published by the author before they appear on the
                book&apos;s page. Your first name and last initial are shown —
                never your email address. If you post this on Amazon or
                Goodreads as well, please mention there that you received a free
                advance copy.
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

async function submitReviewAction(slug: string, formData: FormData) {
  "use server";

  // Server actions are independent entry points: re-check the session and the
  // book assignment, never trust that the page guard ran.
  const reader = await requireReviewingReader();

  if (!reader) redirect("/arc/signin");
  if (!reader.bookSlugs.includes(slug)) notFound();

  const rating = Number(formData.get("rating"));
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!Number.isFinite(rating) || !title || body.length < 40) {
    redirect(`/arc/review/${slug}?status=missing-fields`);
  }

  const result = await submitArcReview({
    bookSlug: slug,
    email: reader.email,
    name: reader.name,
    rating,
    title,
    body,
  });

  if (result !== "ok") {
    redirect(`/arc/review/${slug}?status=${result}`);
  }

  redirect(`/arc/review/${slug}?status=saved`);
}
