/**
 * Verified reader reviews for The Probationers, sourced from Amazon.
 *
 * Shared by the homepage and the book page so the visible quotes and the
 * schema.org Review / AggregateRating markup stay in one place and never drift.
 * Only add real, attributable reviews here — the rating summary and structured
 * data are derived from this list, so a fabricated entry would be a fake rating.
 */
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

/** Average rating rounded to one decimal, derived from REVIEWS. */
export const AVERAGE_RATING =
  Math.round(
    (REVIEWS.reduce((sum, r) => sum + r.rating, 0) / REVIEWS.length) * 10,
  ) / 10;

export const REVIEW_COUNT = REVIEWS.length;

/** schema.org AggregateRating derived from the real reviews above. */
export const aggregateRatingJsonLd = {
  "@type": "AggregateRating",
  ratingValue: AVERAGE_RATING,
  bestRating: BEST_RATING,
  reviewCount: REVIEW_COUNT,
};

/** schema.org Review[] derived from the real reviews above. */
export const reviewsJsonLd = REVIEWS.map((r) => ({
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
}));

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
