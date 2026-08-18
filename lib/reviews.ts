/**
 * Reader reviews for the books, from two sources: verified Amazon purchases
 * (hardcoded below) and approved ARC reader reviews (Firestore).
 *
 * Shared by the homepage and the book page so the visible quotes and the
 * schema.org Review / AggregateRating markup stay in one place and never drift.
 * Only real, attributable reviews feed this — the rating summary and structured
 * data are derived from the merged list, so a fabricated entry would be a fake
 * rating. ARC reviews only ever reach here after the author approves them.
 */
import { getApprovedArcReviews } from "@/lib/arc";

export type Review = {
  /** Reviewer's display name as shown on the public review. */
  name: string;
  /** Review headline. */
  title: string;
  /** ISO date the review was published. */
  date: string;
  /** 1–5 star rating. */
  rating: number;
  /** Review text. */
  body: string;
};

/** A merged review, tagged with where it came from so cards can label it honestly. */
export type PublicReview = Review & { source: "amazon" | "arc" };

export const REVIEWS: Review[] = [
  {
    name: "Zainab Shaikh",
    title: "Mystery",
    date: "2026-06-26",
    rating: 5,
    body: "A gripping mystery with plenty of twists that kept me guessing until the end. The story is well-paced and engaging. Definitely worth reading if you enjoy suspense.",
  },
  {
    name: "Muskan Meman",
    title: "A Mystery Worth Reading",
    date: "2026-05-23",
    rating: 5,
    body: "A gripping mystery thriller that kept me hooked till the very last page. The suspense, twists, and unpredictable moments made it impossible to stop reading. Definitely worth reading for thriller lovers.",
  },
];

export const BEST_RATING = 5;

/** "★★★★★" style string for a whole-star rating. */
export function starString(rating: number): string {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(Math.max(0, BEST_RATING - full));
}

/** Formats an ISO review date as e.g. "June 2026". */
export function formatReviewMonth(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Shortens an ARC reader's name to first name + last initial ("Priya S."),
 * which is what the review form promises them. Amazon reviews keep the display
 * name the reviewer already made public on Amazon.
 */
function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "ARC reader";
  if (parts.length === 1) return parts[0];

  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export type BookReviews = {
  /** Newest first, ARC and Amazon reviews merged. */
  reviews: PublicReview[];
  averageRating: number;
  reviewCount: number;
  /**
   * schema.org AggregateRating / Review[], or undefined when there are no
   * reviews at all — an aggregateRating with reviewCount 0 is invalid markup.
   */
  aggregateRatingJsonLd?: {
    "@type": "AggregateRating";
    ratingValue: number;
    bestRating: number;
    reviewCount: number;
  };
  reviewsJsonLd?: Record<string, unknown>[];
};

/**
 * Merges the hardcoded Amazon reviews with the author-approved ARC reviews for
 * one book, and derives everything the pages and structured data need.
 *
 * `getApprovedArcReviews` returns [] when Firestore is unconfigured or the
 * query fails, so with no Firebase this degrades to exactly the hardcoded
 * output — a build without credentials still ships correct markup.
 */
export async function getBookReviews(bookSlug: string): Promise<BookReviews> {
  const arcReviews = await getApprovedArcReviews(bookSlug);

  const merged: PublicReview[] = [
    ...REVIEWS.map((review) => ({ ...review, source: "amazon" as const })),
    ...arcReviews.map((review) => ({
      name: abbreviateName(review.name),
      title: review.title,
      // The publish date is when the author approved it; fall back to submission.
      date: review.approvedAt || review.submittedAt,
      rating: review.rating,
      body: review.body,
      source: "arc" as const,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const reviewCount = merged.length;

  if (reviewCount === 0) {
    return { reviews: [], averageRating: 0, reviewCount: 0 };
  }

  const averageRating =
    Math.round(
      (merged.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10,
    ) / 10;

  return {
    reviews: merged,
    averageRating,
    reviewCount,
    aggregateRatingJsonLd: {
      "@type": "AggregateRating",
      ratingValue: averageRating,
      bestRating: BEST_RATING,
      reviewCount,
    },
    reviewsJsonLd: merged.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.name },
      datePublished: r.date,
      name: r.title,
      reviewBody: r.body,
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: BEST_RATING,
      },
    })),
  };
}

/**
 * Label shown under a review card, so the source is never misrepresented.
 *
 * ARC reviewers received the book free, which is a material connection the
 * reader is entitled to know about (FTC endorsement guides) — so the label says
 * so plainly rather than hiding behind the "ARC" abbreviation.
 */
export function reviewSourceLabel(source: PublicReview["source"]): string {
  return source === "amazon"
    ? "Verified purchase"
    : "Received a free advance copy";
}
