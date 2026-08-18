import { createHash, randomBytes } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseDb, normalizeDate } from "@/lib/firestore";

/**
 * Data access for the ARC (Advance Reader Copy) program.
 *
 * Follows the lib/firestore.ts conventions: reads degrade to []/null when
 * Firebase isn't configured, admin-facing writes throw, public-facing writes
 * return a result union, every operation is wrapped in try/catch with
 * `[fnName]` logging, and loose Firestore docs are mapped to strict types by
 * normalize* helpers.
 *
 * Collections:
 *   arcBooks/{slug}                 — books in the program
 *   arcBooks/{slug}/chapters/{id}   — manuscript chapters (author-authored HTML)
 *   arcApplications/{email}         — reader applications (email = doc ID)
 *   arcReaders/{email}              — approved readers (email = doc ID)
 *   arcTokens/{sha256(rawToken)}    — single-use magic-link tokens
 *   arcReviews/{bookSlug__email}    — one review per reader per book
 *   arcProgress/{bookSlug__email}   — reading progress beacons
 *   arcReadThrottle/{email}         — chapter-read velocity, one doc per reader
 *
 * Two of those are write-once-per-event rather than one-per-entity, so they
 * would otherwise grow without bound: `arcTokens` gains a document for every
 * sign-in link ever requested, and `arcReadThrottle` one for every reader who
 * ever opened a chapter. Both carry a `purgeAt` timestamp for Firestore's
 * native TTL to collect — see "Expiring the throwaway collections" in the
 * README for the one-time policy setup.
 * Nothing in the app depends on the sweep having happened: expiry is always
 * decided from the document's own fields, so a doc that outlives its purgeAt is
 * merely wasted storage, never wrong behaviour.
 */

// ── Types ────────────────────────────────────────────────────────────────

export type ArcBookStatus = "open" | "closed";

export type ArcBook = {
  slug: string;
  title: string;
  coverUrl?: string;
  description: string;
  status: ArcBookStatus;
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ArcChapter = {
  id: string;
  order: number;
  title: string;
  html: string;
  updatedAt: string;
};

/** Chapter nav entry — order/title only, so listing never loads manuscript HTML. */
export type ArcChapterSummary = {
  id: string;
  order: number;
  title: string;
};

export type ArcApplicationStatus = "pending" | "approved" | "rejected";

export type ArcApplication = {
  email: string;
  name: string;
  reason: string;
  goodreadsUrl?: string;
  amazonProfileUrl?: string;
  status: ArcApplicationStatus;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
};

export type ArcReaderStatus = "active" | "revoked";

export type ArcReader = {
  email: string;
  name: string;
  status: ArcReaderStatus;
  bookSlugs: string[];
  source: "application" | "manual";
  approvedAt: string;
  updatedAt: string;
  revokedAt?: string;
  /**
   * When this reader's access lapses. Absent means non-expiring: readers
   * approved before expiry existed are grandfathered rather than locked out
   * mid-book, and the author can set a window on any of them with Extend.
   */
  accessExpiresAt?: string;
};

export type ArcReviewStatus = "pending" | "approved" | "rejected";

export type ArcReview = {
  bookSlug: string;
  email: string;
  name: string;
  rating: number;
  title: string;
  body: string;
  status: ArcReviewStatus;
  submittedAt: string;
  updatedAt: string;
  approvedAt?: string;
  /**
   * Why a review was not published. Required when rejecting, and kept on record:
   * declining reviews needs to be defensible on objective grounds (spam, spoilers,
   * abuse, not a real reader) rather than because a rating was unflattering.
   * Suppressing negative reviews while showing an aggregate rating is exactly
   * what the FTC's consumer-review rule prohibits.
   */
  rejectionReason?: string;
};

export type ArcProgress = {
  bookSlug: string;
  email: string;
  chapterOrder: number;
  percent: number;
  lastReadAt: string;
};

export type ArcWriteResult = "ok" | "duplicate" | "not-configured" | "error";

/** Thrown when creating a book whose slug is already taken. */
export class BookSlugTakenError extends Error {
  constructor(slug: string) {
    super(`An ARC book with the slug "${slug}" already exists.`);
    this.name = "BookSlugTakenError";
  }
}

/** Thrown when a chapter's HTML would push the Firestore doc near its 1MB limit. */
export class ChapterTooLargeError extends Error {
  constructor() {
    super("Chapter content is too large for a single chapter.");
    this.name = "ChapterTooLargeError";
  }
}

const MAX_CHAPTER_HTML_LENGTH = 900_000;

// Bulk-import batching. Firestore caps a request at 10MB and chapter HTML can
// reach 800KB, so writes are chunked on size as well as count.
const BULK_BATCH_MAX_WRITES = 10;
const BULK_BATCH_MAX_BYTES = 5_000_000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Reading window granted when a reader is approved. */
const DEFAULT_ACCESS_DAYS = 30;

// ── Normalizers ──────────────────────────────────────────────────────────

type Doc = FirebaseFirestore.DocumentData;

function normalizeBook(slug: string, data: Doc): ArcBook {
  return {
    slug,
    title: data.title ?? "Untitled book",
    coverUrl: data.coverUrl || undefined,
    description: data.description ?? "",
    status: data.status === "closed" ? "closed" : "open",
    chapterCount: typeof data.chapterCount === "number" ? data.chapterCount : 0,
    createdAt: normalizeDate(data.createdAt),
    updatedAt: normalizeDate(data.updatedAt),
  };
}

function normalizeApplication(email: string, data: Doc): ArcApplication {
  return {
    email,
    name: data.name ?? "",
    reason: data.reason ?? "",
    goodreadsUrl: data.goodreadsUrl || undefined,
    amazonProfileUrl: data.amazonProfileUrl || undefined,
    status:
      data.status === "approved" || data.status === "rejected"
        ? data.status
        : "pending",
    createdAt: normalizeDate(data.createdAt),
    updatedAt: normalizeDate(data.updatedAt),
    decidedAt: data.decidedAt ? normalizeDate(data.decidedAt) : undefined,
  };
}

function normalizeReader(email: string, data: Doc): ArcReader {
  return {
    email,
    name: data.name ?? "",
    status: data.status === "revoked" ? "revoked" : "active",
    bookSlugs: Array.isArray(data.bookSlugs) ? data.bookSlugs : [],
    source: data.source === "manual" ? "manual" : "application",
    approvedAt: normalizeDate(data.approvedAt),
    updatedAt: normalizeDate(data.updatedAt),
    revokedAt: data.revokedAt ? normalizeDate(data.revokedAt) : undefined,
    accessExpiresAt: data.accessExpiresAt
      ? normalizeDate(data.accessExpiresAt)
      : undefined,
  };
}

function normalizeReview(data: Doc): ArcReview {
  return {
    bookSlug: data.bookSlug ?? "",
    email: data.email ?? "",
    name: data.name ?? "",
    rating: clampRating(data.rating),
    title: data.title ?? "",
    body: data.body ?? "",
    status:
      data.status === "approved" || data.status === "rejected"
        ? data.status
        : "pending",
    submittedAt: normalizeDate(data.submittedAt),
    updatedAt: normalizeDate(data.updatedAt),
    approvedAt: data.approvedAt ? normalizeDate(data.approvedAt) : undefined,
    rejectionReason: data.rejectionReason
      ? String(data.rejectionReason)
      : undefined,
  };
}

function normalizeProgress(data: Doc): ArcProgress {
  return {
    bookSlug: data.bookSlug ?? "",
    email: data.email ?? "",
    chapterOrder:
      typeof data.chapterOrder === "number" && data.chapterOrder >= 1
        ? Math.floor(data.chapterOrder)
        : 1,
    percent:
      typeof data.percent === "number"
        ? Math.min(100, Math.max(0, data.percent))
        : 0,
    lastReadAt: normalizeDate(data.lastReadAt),
  };
}

function clampRating(value: unknown): number {
  const n = typeof value === "number" ? Math.round(value) : NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, n));
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Composite doc ID for per-reader-per-book records. Fields stay authoritative. */
function readerBookId(bookSlug: string, email: string) {
  return `${bookSlug}__${normalizeEmail(email)}`;
}

// ── Applications ─────────────────────────────────────────────────────────

export type ArcApplicationInput = {
  email: string;
  name: string;
  reason: string;
  goodreadsUrl?: string;
  amazonProfileUrl?: string;
};

/**
 * Saves an ARC application. The lowercased email is the document ID, so a
 * repeat submission while pending/approved is a natural "duplicate" no-op —
 * only a previously rejected applicant can re-apply (resets to pending).
 */
export async function addArcApplication(
  input: ArcApplicationInput,
): Promise<ArcWriteResult> {
  const db = getFirebaseDb();

  if (!db) {
    return "not-configured";
  }

  const email = normalizeEmail(input.email);

  try {
    const ref = db.collection("arcApplications").doc(email);
    const existing = await ref.get();

    if (existing.exists && existing.data()?.status !== "rejected") {
      return "duplicate";
    }

    const now = Timestamp.now();

    await ref.set({
      email,
      name: input.name.trim(),
      reason: input.reason.trim(),
      goodreadsUrl: input.goodreadsUrl?.trim() ?? "",
      amazonProfileUrl: input.amazonProfileUrl?.trim() ?? "",
      status: "pending",
      createdAt: existing.exists ? (existing.data()?.createdAt ?? now) : now,
      updatedAt: now,
      decidedAt: null,
    });

    return "ok";
  } catch (err) {
    console.error("[addArcApplication]", err);
    return "error";
  }
}

export async function getAllApplications(): Promise<ArcApplication[]> {
  const db = getFirebaseDb();

  if (!db) {
    return [];
  }

  try {
    const snapshot = await db.collection("arcApplications").get();

    return snapshot.docs
      .map((doc) => normalizeApplication(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    console.error("[getAllApplications]", err);
    return [];
  }
}

export async function decideApplication(
  email: string,
  decision: "approved" | "rejected",
) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const now = Timestamp.now();

  await db.collection("arcApplications").doc(normalizeEmail(email)).update({
    status: decision,
    decidedAt: now,
    updatedAt: now,
  });
}

// ── Readers ──────────────────────────────────────────────────────────────

/**
 * Creates or reactivates a reader. On an existing doc the original approvedAt
 * is kept and assigned books are unioned, so approving a returning reader
 * never loses history.
 */
export async function upsertArcReader(input: {
  email: string;
  name: string;
  bookSlugs: string[];
  source: "application" | "manual";
}) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const email = normalizeEmail(input.email);
  const ref = db.collection("arcReaders").doc(email);
  const existing = await ref.get();
  const now = Timestamp.now();

  // Approving anyone — first time or returning — is a fresh reading window.
  const accessExpiresAt = Timestamp.fromMillis(
    now.toMillis() + DEFAULT_ACCESS_DAYS * DAY_MS,
  );

  if (existing.exists) {
    const update: Record<string, unknown> = {
      name: input.name.trim() || (existing.data()?.name ?? ""),
      status: "active",
      updatedAt: now,
      accessExpiresAt,
    };

    if (input.bookSlugs.length) {
      update.bookSlugs = FieldValue.arrayUnion(...input.bookSlugs);
    }

    await ref.update(update);
    return;
  }

  await ref.set({
    email,
    name: input.name.trim(),
    status: "active",
    bookSlugs: input.bookSlugs.filter(Boolean),
    source: input.source,
    approvedAt: now,
    updatedAt: now,
    accessExpiresAt,
  });
}

export async function getArcReader(email: string): Promise<ArcReader | null> {
  const db = getFirebaseDb();

  if (!db) {
    return null;
  }

  try {
    const doc = await db
      .collection("arcReaders")
      .doc(normalizeEmail(email))
      .get();

    return doc.exists ? normalizeReader(doc.id, doc.data() as Doc) : null;
  } catch (err) {
    console.error("[getArcReader]", err);
    return null;
  }
}

export async function getAllArcReaders(): Promise<ArcReader[]> {
  const db = getFirebaseDb();

  if (!db) {
    return [];
  }

  try {
    const snapshot = await db.collection("arcReaders").get();

    return snapshot.docs
      .map((doc) => normalizeReader(doc.id, doc.data()))
      .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
  } catch (err) {
    console.error("[getAllArcReaders]", err);
    return [];
  }
}

export async function setReaderStatus(email: string, status: ArcReaderStatus) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const now = Timestamp.now();

  await db
    .collection("arcReaders")
    .doc(normalizeEmail(email))
    .update({
      status,
      updatedAt: now,
      ...(status === "revoked" ? { revokedAt: now } : {}),
    });
}

/**
 * Grants a fresh reading window of `days` from now. Absolute rather than
 * additive, so "30 days" always means the same thing to the author no matter
 * what the reader's current expiry happens to be.
 */
export async function extendReaderAccess(email: string, days: number) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const now = Timestamp.now();

  await db
    .collection("arcReaders")
    .doc(normalizeEmail(email))
    .update({
      accessExpiresAt: Timestamp.fromMillis(now.toMillis() + days * DAY_MS),
      updatedAt: now,
    });
}

export async function assignBook(email: string, bookSlug: string) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  await db.collection("arcReaders").doc(normalizeEmail(email)).update({
    bookSlugs: FieldValue.arrayUnion(bookSlug),
    updatedAt: Timestamp.now(),
  });
}

export async function unassignBook(email: string, bookSlug: string) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  await db.collection("arcReaders").doc(normalizeEmail(email)).update({
    bookSlugs: FieldValue.arrayRemove(bookSlug),
    updatedAt: Timestamp.now(),
  });
}

// ── Magic-link tokens ────────────────────────────────────────────────────

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAGIC_LINK_MIN_GAP_MS = 60 * 1000; // ≥ 60s between sends
const MAGIC_LINK_DAILY_CAP = 10;

// Chapter-read velocity. 15 distinct chapters inside 10 minutes is well past
// any plausible reading pace but comfortably clear of normal back-and-forth
// navigation, so genuine readers never see the brake.
const READ_WINDOW_MS = 10 * 60 * 1000;
const READ_WINDOW_MAX_DISTINCT = 15;
const READ_BLOCK_MS = 10 * 60 * 1000;

/**
 * How long a throttle doc stays useful after its last write — comfortably past
 * both the window and the block, then rounded up. See the `purgeAt` note in the
 * file header.
 */
const THROTTLE_PURGE_AFTER_MS = 60 * 60 * 1000;

/**
 * Grace period before a spent magic-link token is swept up. Kept well past the
 * token's own 15-minute validity so redeeming a stale link still reports
 * "expired" rather than the blanker "invalid".
 */
const TOKEN_PURGE_AFTER_MS = 24 * 60 * 60 * 1000;

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Per-reader send throttle, kept as fields on the arcReaders doc so no extra
 * collection or composite index is needed. Runs in a transaction so parallel
 * requests can't both pass. Returns "ok" only when the caller may send.
 */
export async function checkAndStampMagicLinkThrottle(
  email: string,
): Promise<"ok" | "throttled" | "not-configured" | "error"> {
  const db = getFirebaseDb();

  if (!db) {
    return "not-configured";
  }

  const ref = db.collection("arcReaders").doc(normalizeEmail(email));
  const dayKey = new Date().toISOString().slice(0, 10);

  try {
    return await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);

      if (!doc.exists) {
        return "error" as const;
      }

      const data = doc.data() as Doc;
      const last = data.lastMagicLinkRequestAt;
      const lastMs =
        last instanceof Timestamp ? last.toMillis() : 0;

      if (Date.now() - lastMs < MAGIC_LINK_MIN_GAP_MS) {
        return "throttled" as const;
      }

      const count = data.magicLinkDayKey === dayKey ? (data.magicLinkDayCount ?? 0) : 0;

      if (count >= MAGIC_LINK_DAILY_CAP) {
        return "throttled" as const;
      }

      tx.update(ref, {
        lastMagicLinkRequestAt: Timestamp.now(),
        magicLinkDayKey: dayKey,
        magicLinkDayCount: count + 1,
      });

      return "ok" as const;
    });
  } catch (err) {
    console.error("[checkAndStampMagicLinkThrottle]", err);
    return "error";
  }
}

/**
 * Per-address brake on ARC applications.
 *
 * The apply form is the only unauthenticated endpoint here that both writes to
 * Firestore and sends mail — one to the applicant, one to the author — for an
 * address the caller chose. Unthrottled, that's an open relay: someone can make
 * this domain mail strangers on demand, and the deliverability it burns belongs
 * to the same domain the magic links depend on, so the damage lands on reader
 * sign-in rather than just being noise.
 *
 * Keyed by hashed client address rather than by email, because the submitted
 * email is exactly the field an abuser varies. Applications are a rare event, so
 * the allowance is deliberately tight; a shared office or household NAT still
 * fits comfortably inside it.
 *
 * Fail-open on error, like the read throttle: a Firestore hiccup must not turn
 * a genuine application away.
 */
const APPLY_WINDOW_MS = 60 * 60 * 1000;
const APPLY_WINDOW_MAX = 3;
const APPLY_BLOCK_MS = 60 * 60 * 1000;
const APPLY_PURGE_AFTER_MS = 3 * 60 * 60 * 1000;

export async function checkAndStampApplyThrottle(
  key: string,
): Promise<"ok" | "limited"> {
  const db = getFirebaseDb();

  if (!db) {
    return "ok";
  }

  const ref = db.collection("arcApplyThrottle").doc(key);
  const now = Date.now();

  try {
    const doc = await ref.get();
    const data = doc.exists ? (doc.data() as Doc) : null;

    const blockedUntil =
      data?.blockedUntil instanceof Timestamp
        ? data.blockedUntil.toMillis()
        : 0;

    if (blockedUntil > now) {
      return "limited";
    }

    const windowStart =
      data?.windowStart instanceof Timestamp ? data.windowStart.toMillis() : 0;
    const count = typeof data?.count === "number" ? data.count : 0;
    const purgeAt = Timestamp.fromMillis(now + APPLY_PURGE_AFTER_MS);

    // Window elapsed (or first ever application): start a fresh one.
    if (!windowStart || now - windowStart > APPLY_WINDOW_MS) {
      await ref.set({
        windowStart: Timestamp.fromMillis(now),
        count: 1,
        blockedUntil: null,
        updatedAt: Timestamp.now(),
        purgeAt,
      });

      return "ok";
    }

    const next = count + 1;

    if (next > APPLY_WINDOW_MAX) {
      await ref.set({
        windowStart: Timestamp.fromMillis(windowStart),
        count: next,
        blockedUntil: Timestamp.fromMillis(now + APPLY_BLOCK_MS),
        updatedAt: Timestamp.now(),
        purgeAt,
      });

      return "limited";
    }

    await ref.set(
      { count: next, updatedAt: Timestamp.now(), purgeAt },
      { merge: true },
    );

    return "ok";
  } catch (err) {
    console.error("[checkAndStampApplyThrottle]", err);
    return "ok";
  }
}

/**
 * Scrape brake for the reader. Counts *distinct* chapters opened inside a
 * rolling window, so ordinary reading — including re-reading or refreshing one
 * chapter — never trips it, but pulling the whole manuscript in one burst does.
 *
 * Deliberately soft and fail-open: any error returns "ok", and tripping the
 * limit only pauses reading for a few minutes. It never touches reader status,
 * because a false positive must not cost a genuine reader their access.
 *
 * Not transactional, unlike the magic-link throttle: the worst a race can do is
 * let a scraper have one extra chapter, which isn't worth the contention on a
 * doc written on every page view.
 */
export async function checkAndStampReadThrottle(
  email: string,
  bookSlug: string,
  order: number,
): Promise<"ok" | "limited"> {
  const db = getFirebaseDb();

  if (!db) {
    return "ok";
  }

  const ref = db.collection("arcReadThrottle").doc(normalizeEmail(email));
  const key = `${bookSlug}:${order}`;
  const now = Date.now();

  try {
    const doc = await ref.get();
    const data = doc.exists ? (doc.data() as Doc) : null;

    const blockedUntil =
      data?.blockedUntil instanceof Timestamp
        ? data.blockedUntil.toMillis()
        : 0;

    if (blockedUntil > now) {
      return "limited";
    }

    const windowStart =
      data?.windowStart instanceof Timestamp ? data.windowStart.toMillis() : 0;
    const seen: string[] = Array.isArray(data?.chapterKeys)
      ? data.chapterKeys
      : [];

    // Refreshed on every write, so a doc only survives while it means something.
    const purgeAt = Timestamp.fromMillis(now + THROTTLE_PURGE_AFTER_MS);

    // Window elapsed (or first ever read): start a fresh one.
    if (!windowStart || now - windowStart > READ_WINDOW_MS) {
      await ref.set({
        windowStart: Timestamp.fromMillis(now),
        chapterKeys: [key],
        blockedUntil: null,
        updatedAt: Timestamp.now(),
        purgeAt,
      });
      return "ok";
    }

    // Already counted this chapter in this window — free to revisit.
    if (seen.includes(key)) {
      return "ok";
    }

    if (seen.length + 1 > READ_WINDOW_MAX_DISTINCT) {
      await ref.update({
        blockedUntil: Timestamp.fromMillis(now + READ_BLOCK_MS),
        updatedAt: Timestamp.now(),
        purgeAt,
      });
      return "limited";
    }

    await ref.update({
      chapterKeys: FieldValue.arrayUnion(key),
      updatedAt: Timestamp.now(),
      purgeAt,
    });

    return "ok";
  } catch (err) {
    console.error("[checkAndStampReadThrottle]", err);
    return "ok";
  }
}

/**
 * Mints a single-use magic-link token. Only the SHA-256 hash is stored — the
 * raw token exists solely in the emailed URL. Returns null when Firebase is
 * unconfigured or the write fails.
 */
export async function createMagicLinkToken(
  email: string,
): Promise<string | null> {
  const db = getFirebaseDb();

  if (!db) {
    return null;
  }

  const raw = randomBytes(32).toString("base64url");
  const now = Timestamp.now();

  try {
    await db.collection("arcTokens").doc(hashToken(raw)).set({
      email: normalizeEmail(email),
      createdAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + TOKEN_TTL_MS),
      usedAt: null,
      purgeAt: Timestamp.fromMillis(now.toMillis() + TOKEN_PURGE_AFTER_MS),
    });

    return raw;
  } catch (err) {
    console.error("[createMagicLinkToken]", err);
    return null;
  }
}

export type RedeemResult =
  | { status: "ok"; email: string }
  | { status: "invalid" | "used" | "expired" | "revoked" | "not-configured" };

/**
 * Redeems a magic-link token. Runs in a transaction so two concurrent
 * redemptions of the same token can't both succeed, and verifies the reader
 * is still active inside the same transaction.
 */
export async function redeemMagicLinkToken(raw: string): Promise<RedeemResult> {
  const db = getFirebaseDb();

  if (!db) {
    return { status: "not-configured" };
  }

  if (!raw || raw.length > 200) {
    return { status: "invalid" };
  }

  const tokenRef = db.collection("arcTokens").doc(hashToken(raw));

  try {
    return await db.runTransaction(async (tx): Promise<RedeemResult> => {
      const tokenDoc = await tx.get(tokenRef);

      if (!tokenDoc.exists) {
        return { status: "invalid" };
      }

      const data = tokenDoc.data() as Doc;

      if (data.usedAt) {
        return { status: "used" };
      }

      const expiresAt = data.expiresAt;
      const expiresMs =
        expiresAt instanceof Timestamp ? expiresAt.toMillis() : 0;

      if (expiresMs < Date.now()) {
        return { status: "expired" };
      }

      const email = String(data.email ?? "");
      const readerDoc = await tx.get(db.collection("arcReaders").doc(email));

      if (!readerDoc.exists || readerDoc.data()?.status !== "active") {
        return { status: "revoked" };
      }

      tx.update(tokenRef, { usedAt: Timestamp.now() });

      return { status: "ok", email };
    });
  } catch (err) {
    console.error("[redeemMagicLinkToken]", err);
    return { status: "invalid" };
  }
}

// ── Books & chapters ─────────────────────────────────────────────────────

export async function getArcBooks(): Promise<ArcBook[]> {
  const db = getFirebaseDb();

  if (!db) {
    return [];
  }

  try {
    const snapshot = await db.collection("arcBooks").get();

    return snapshot.docs
      .map((doc) => normalizeBook(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    console.error("[getArcBooks]", err);
    return [];
  }
}

export async function getArcBook(slug: string): Promise<ArcBook | null> {
  const db = getFirebaseDb();

  if (!db) {
    return null;
  }

  try {
    const doc = await db.collection("arcBooks").doc(slug).get();
    return doc.exists ? normalizeBook(doc.id, doc.data() as Doc) : null;
  } catch (err) {
    console.error("[getArcBook]", err);
    return null;
  }
}

export type ArcBookInput = {
  title: string;
  description: string;
  coverUrl?: string;
  status: ArcBookStatus;
};

export async function createArcBook(slug: string, input: ArcBookInput) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const ref = db.collection("arcBooks").doc(slug);
  const existing = await ref.get();

  if (existing.exists) {
    throw new BookSlugTakenError(slug);
  }

  const now = Timestamp.now();

  await ref.set({
    slug,
    title: input.title.trim(),
    description: input.description.trim(),
    coverUrl: input.coverUrl?.trim() ?? "",
    status: input.status,
    chapterCount: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateArcBook(slug: string, input: Partial<ArcBookInput>) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  await db
    .collection("arcBooks")
    .doc(slug)
    .update({
      ...input,
      updatedAt: Timestamp.now(),
    });
}

/**
 * Chapter list without manuscript HTML (`select` keeps the payload tiny), for
 * nav and admin listings. Ordered by the 1-based `order` field.
 */
export async function getChapterSummaries(
  bookSlug: string,
): Promise<ArcChapterSummary[]> {
  const db = getFirebaseDb();

  if (!db) {
    return [];
  }

  try {
    const snapshot = await db
      .collection("arcBooks")
      .doc(bookSlug)
      .collection("chapters")
      .orderBy("order")
      .select("order", "title")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      order: typeof doc.data().order === "number" ? doc.data().order : 0,
      title: doc.data().title ?? "Untitled chapter",
    }));
  } catch (err) {
    console.error("[getChapterSummaries]", err);
    return [];
  }
}

export async function getChapter(
  bookSlug: string,
  chapterId: string,
): Promise<ArcChapter | null> {
  const db = getFirebaseDb();

  if (!db) {
    return null;
  }

  try {
    const doc = await db
      .collection("arcBooks")
      .doc(bookSlug)
      .collection("chapters")
      .doc(chapterId)
      .get();

    if (!doc.exists) return null;

    const data = doc.data() as Doc;

    return {
      id: doc.id,
      order: typeof data.order === "number" ? data.order : 0,
      title: data.title ?? "Untitled chapter",
      html: data.html ?? "",
      updatedAt: normalizeDate(data.updatedAt),
    };
  } catch (err) {
    console.error("[getChapter]", err);
    return null;
  }
}

/** The chapter a reader sees at `?chapter=N`. */
export async function getChapterByOrder(
  bookSlug: string,
  order: number,
): Promise<ArcChapter | null> {
  const db = getFirebaseDb();

  if (!db) {
    return null;
  }

  try {
    const snapshot = await db
      .collection("arcBooks")
      .doc(bookSlug)
      .collection("chapters")
      .where("order", "==", order)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    if (!doc) return null;

    const data = doc.data() as Doc;

    return {
      id: doc.id,
      order: typeof data.order === "number" ? data.order : 0,
      title: data.title ?? "Untitled chapter",
      html: data.html ?? "",
      updatedAt: normalizeDate(data.updatedAt),
    };
  } catch (err) {
    console.error("[getChapterByOrder]", err);
    return null;
  }
}

async function syncChapterCount(
  db: NonNullable<ReturnType<typeof getFirebaseDb>>,
  bookSlug: string,
) {
  const count = await db
    .collection("arcBooks")
    .doc(bookSlug)
    .collection("chapters")
    .count()
    .get();

  await db.collection("arcBooks").doc(bookSlug).update({
    chapterCount: count.data().count,
    updatedAt: Timestamp.now(),
  });
}

export type SaveChapterInput = {
  order: number;
  title: string;
  html: string;
};

/**
 * Creates (chapterId undefined) or updates a chapter. Rejects HTML that would
 * approach Firestore's 1MB document limit — split the chapter instead.
 */
export async function saveChapter(
  bookSlug: string,
  input: SaveChapterInput,
  chapterId?: string,
): Promise<string> {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  if (input.html.length > MAX_CHAPTER_HTML_LENGTH) {
    throw new ChapterTooLargeError();
  }

  const chapters = db.collection("arcBooks").doc(bookSlug).collection("chapters");
  const payload = {
    order: input.order,
    title: input.title.trim(),
    html: input.html,
    updatedAt: Timestamp.now(),
  };

  if (chapterId) {
    await chapters.doc(chapterId).update(payload);
    await syncChapterCount(db, bookSlug);
    return chapterId;
  }

  const ref = await chapters.add(payload);
  await syncChapterCount(db, bookSlug);
  return ref.id;
}

/**
 * Writes many chapters at once, for the EPUB importer.
 *
 * Deliberately not a loop over `saveChapter`: that syncs the book's chapter
 * count on every call, which for a 40-chapter novel would mean 40 count
 * aggregates and 40 book-doc writes. This batches the chapter writes and syncs
 * the count once at the end.
 *
 * Batches are chunked by both document count and accumulated payload size —
 * chapters can approach 800KB each and a Firestore request caps out at 10MB.
 *
 * Returns the number of chapters written.
 */
export async function saveChaptersBulk(
  bookSlug: string,
  inputs: SaveChapterInput[],
): Promise<number> {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  for (const input of inputs) {
    if (input.html.length > MAX_CHAPTER_HTML_LENGTH) {
      throw new ChapterTooLargeError();
    }
  }

  const chapters = db.collection("arcBooks").doc(bookSlug).collection("chapters");
  const now = Timestamp.now();

  let batch = db.batch();
  let pending = 0;
  let pendingBytes = 0;

  const flush = async () => {
    if (pending === 0) return;
    await batch.commit();
    batch = db.batch();
    pending = 0;
    pendingBytes = 0;
  };

  for (const input of inputs) {
    if (
      pending > 0 &&
      (pending >= BULK_BATCH_MAX_WRITES ||
        pendingBytes + input.html.length > BULK_BATCH_MAX_BYTES)
    ) {
      await flush();
    }

    batch.set(chapters.doc(), {
      order: input.order,
      title: input.title.trim(),
      html: input.html,
      updatedAt: now,
    });

    pending += 1;
    pendingBytes += input.html.length;
  }

  await flush();
  await syncChapterCount(db, bookSlug);

  return inputs.length;
}

export async function deleteChapter(bookSlug: string, chapterId: string) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  await db
    .collection("arcBooks")
    .doc(bookSlug)
    .collection("chapters")
    .doc(chapterId)
    .delete();
  await syncChapterCount(db, bookSlug);
}

// ── Reviews ──────────────────────────────────────────────────────────────

export type SubmitReviewInput = {
  bookSlug: string;
  email: string;
  name: string;
  rating: number;
  title: string;
  body: string;
};

/**
 * Submits (or resubmits) a reader's review. Title and body are stored as
 * PLAIN TEXT — they are untrusted input and must only ever be rendered as JSX
 * text nodes, never HTML. A review is editable while pending/rejected and
 * locked once approved.
 */
export async function submitArcReview(
  input: SubmitReviewInput,
): Promise<"ok" | "locked" | "not-configured" | "error"> {
  const db = getFirebaseDb();

  if (!db) {
    return "not-configured";
  }

  const email = normalizeEmail(input.email);
  const ref = db.collection("arcReviews").doc(readerBookId(input.bookSlug, email));

  try {
    const existing = await ref.get();

    if (existing.exists && existing.data()?.status === "approved") {
      return "locked";
    }

    const now = Timestamp.now();

    await ref.set({
      bookSlug: input.bookSlug,
      email,
      name: input.name.trim(),
      rating: clampRating(input.rating),
      title: input.title.trim().slice(0, 120),
      body: input.body.trim().slice(0, 2000),
      status: "pending",
      submittedAt: existing.exists ? (existing.data()?.submittedAt ?? now) : now,
      updatedAt: now,
      approvedAt: null,
    });

    return "ok";
  } catch (err) {
    console.error("[submitArcReview]", err);
    return "error";
  }
}

export async function getArcReview(
  bookSlug: string,
  email: string,
): Promise<ArcReview | null> {
  const db = getFirebaseDb();

  if (!db) {
    return null;
  }

  try {
    const doc = await db
      .collection("arcReviews")
      .doc(readerBookId(bookSlug, email))
      .get();

    return doc.exists ? normalizeReview(doc.data() as Doc) : null;
  } catch (err) {
    console.error("[getArcReview]", err);
    return null;
  }
}

export async function getAllArcReviews(): Promise<ArcReview[]> {
  const db = getFirebaseDb();

  if (!db) {
    return [];
  }

  try {
    const snapshot = await db.collection("arcReviews").get();

    return snapshot.docs
      .map((doc) => normalizeReview(doc.data()))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  } catch (err) {
    console.error("[getAllArcReviews]", err);
    return [];
  }
}

/**
 * Approved reviews for a book — the only review query the public site runs.
 * Two equality filters use automatic single-field indexes (no composite);
 * sorting happens in memory because result sets are small.
 */
export async function getApprovedArcReviews(
  bookSlug: string,
): Promise<ArcReview[]> {
  const db = getFirebaseDb();

  if (!db) {
    return [];
  }

  try {
    const snapshot = await db
      .collection("arcReviews")
      .where("bookSlug", "==", bookSlug)
      .where("status", "==", "approved")
      .get();

    return snapshot.docs
      .map((doc) => normalizeReview(doc.data()))
      .sort((a, b) => (b.approvedAt ?? "").localeCompare(a.approvedAt ?? ""));
  } catch (err) {
    console.error("[getApprovedArcReviews]", err);
    return [];
  }
}

/**
 * Publishes or declines a reader's review.
 *
 * A rejection carries a reason, kept on the document as an audit trail — see the
 * note on `ArcReview.rejectionReason`.
 */
export async function decideArcReview(
  bookSlug: string,
  email: string,
  decision: "approved" | "rejected",
  rejectionReason?: string,
) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const now = Timestamp.now();

  await db
    .collection("arcReviews")
    .doc(readerBookId(bookSlug, email))
    .update({
      status: decision,
      updatedAt: now,
      approvedAt: decision === "approved" ? now : null,
      rejectionReason:
        decision === "rejected" ? (rejectionReason ?? "").trim() : null,
    });
}

// ── Reading progress ─────────────────────────────────────────────────────

/**
 * Best-effort progress upsert from the reader-page beacon. Failures are
 * swallowed — progress must never break reading.
 */
export async function saveArcProgress(
  email: string,
  bookSlug: string,
  chapterOrder: number,
  percent: number,
): Promise<void> {
  const db = getFirebaseDb();

  if (!db) {
    return;
  }

  try {
    await db
      .collection("arcProgress")
      .doc(readerBookId(bookSlug, email))
      .set({
        bookSlug,
        email: normalizeEmail(email),
        chapterOrder: Math.max(1, Math.floor(chapterOrder)),
        percent: Math.min(100, Math.max(0, Math.round(percent))),
        lastReadAt: Timestamp.now(),
      });
  } catch (err) {
    console.error("[saveArcProgress]", err);
  }
}

export async function getArcProgress(
  email: string,
  bookSlug: string,
): Promise<ArcProgress | null> {
  const db = getFirebaseDb();

  if (!db) {
    return null;
  }

  try {
    const doc = await db
      .collection("arcProgress")
      .doc(readerBookId(bookSlug, email))
      .get();

    return doc.exists ? normalizeProgress(doc.data() as Doc) : null;
  } catch (err) {
    console.error("[getArcProgress]", err);
    return null;
  }
}
