import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ArcAdminBar } from "@/components/ArcAdminBar";
import { decideArcReview, getAllArcReviews, getArcBooks, type ArcReview } from "@/lib/arc";
import { starString } from "@/lib/reviews";

type Props = { searchParams: Promise<{ status?: string }> };

export const metadata = {
  title: "ARC Reviews | Admin",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  failed: "That action failed. Check the server logs and try again.",
  "missing-reason":
    "Declining a review needs a reason — it's kept on record so moderation stays defensible.",
};

const NOTICES: Record<string, string> = {
  approved: "Review published — it now appears on the book page and in its structured data.",
  rejected: "Review declined, with your reason kept on record. The reader can edit and resubmit it.",
};

export default async function AdminArcReviewsPage({ searchParams }: Props) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { status } = await searchParams;
  const [reviews, books] = await Promise.all([getAllArcReviews(), getArcBooks()]);

  const pending = reviews.filter((r) => r.status === "pending");
  const decided = reviews.filter((r) => r.status !== "pending");

  const bookTitle = (slug: string) =>
    books.find((b) => b.slug === slug)?.title ?? slug;

  return (
    <main className="mEditorPage">
      <ArcAdminBar
        current="reviews"
        error={status ? ERRORS[status] : undefined}
        notice={status ? NOTICES[status] : undefined}
      />

      <div className="mPostList">
        {reviews.length === 0 && (
          <div className="mPostListEmpty">
            <p>
              No ARC reviews yet. They arrive once readers finish a book from
              their <Link href="/admin/arc/readers">library</Link>.
            </p>
          </div>
        )}

        {pending.length > 0 && (
          <section>
            <h2 className="mPostListHeading">
              Awaiting your approval · {pending.length}
            </h2>
            <ul className="mPostListItems">
              {pending.map((review) => (
                <li className="mPostListItem" key={`${review.bookSlug}-${review.email}`}>
                  <ReviewSummary review={review} bookTitle={bookTitle(review.bookSlug)} />

                  <div className="mArcRowActions">
                    <form action={approveAction}>
                      <input
                        type="hidden"
                        name="bookSlug"
                        value={review.bookSlug}
                      />
                      <input type="hidden" name="email" value={review.email} />
                      <button type="submit" className="mBtnPublish">
                        Publish review
                      </button>
                    </form>

                    <RejectForm review={review} label="Reject" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {decided.length > 0 && (
          <section>
            <h2 className="mPostListHeading">Decided</h2>
            <ul className="mPostListItems">
              {decided.map((review) => (
                <li className="mPostListItem" key={`${review.bookSlug}-${review.email}`}>
                  <ReviewSummary review={review} bookTitle={bookTitle(review.bookSlug)} />

                  {review.status === "approved" && (
                    <div className="mArcRowActions">
                      <RejectForm review={review} label="Unpublish" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

/**
 * Declining a review always captures why. Reviews feed the public rating and its
 * aggregateRating markup, so the record needs to show that reviews were declined
 * on objective grounds — spam, spoilers, abuse, not a real reader — and never
 * for being unflattering.
 */
function RejectForm({ review, label }: { review: ArcReview; label: string }) {
  return (
    <form action={rejectAction} className="mArcInlineForm">
      <input type="hidden" name="bookSlug" value={review.bookSlug} />
      <input type="hidden" name="email" value={review.email} />
      <input
        type="text"
        name="reason"
        required
        maxLength={500}
        placeholder="Reason (required — kept on record)"
        aria-label="Reason for declining this review"
      />
      <button type="submit" className="mBtnDraft">
        {label}
      </button>
    </form>
  );
}

function ReviewSummary({
  review,
  bookTitle,
}: {
  review: ArcReview;
  bookTitle: string;
}) {
  return (
    <>
      <div className="mPostListMeta">
        <span className={`arcStatusBadge arcStatus${cap(review.status)}`}>
          {review.status}
        </span>
        <span className="mArcStars" aria-label={`${review.rating} out of 5`}>
          {starString(review.rating)}
        </span>
        <span className="mPostListDate">{bookTitle}</span>
      </div>

      {/* Reader-submitted text: plain-text nodes only, never HTML. */}
      <p className="mPostListTitle">{review.title}</p>
      <p className="mArcReviewBody">{review.body}</p>
      <p className="mPostListExcerpt">
        {review.name || "Unnamed reader"}{" "}
        <span className="mArcEmail">{review.email}</span>
        {review.submittedAt ? ` · ${formatDate(review.submittedAt)}` : ""}
      </p>

      {review.status === "rejected" && review.rejectionReason && (
        <p className="mArcRejectReason">
          Declined: {review.rejectionReason}
        </p>
      )}
    </>
  );
}

async function approveAction(formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const bookSlug = String(formData.get("bookSlug") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!bookSlug || !email) redirect("/admin/arc/reviews?status=failed");

  try {
    await decideArcReview(bookSlug, email, "approved");
  } catch (err) {
    console.error("[approveAction]", err);
    redirect("/admin/arc/reviews?status=failed");
  }

  redirect("/admin/arc/reviews?status=approved");
}

async function rejectAction(formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const bookSlug = String(formData.get("bookSlug") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!bookSlug || !email) redirect("/admin/arc/reviews?status=failed");

  // The browser enforces `required`, but the action is the real gate.
  if (!reason) redirect("/admin/arc/reviews?status=missing-reason");

  try {
    await decideArcReview(bookSlug, email, "rejected", reason.slice(0, 500));
  } catch (err) {
    console.error("[rejectAction]", err);
    redirect("/admin/arc/reviews?status=failed");
  }

  redirect("/admin/arc/reviews?status=rejected");
}

function cap(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
